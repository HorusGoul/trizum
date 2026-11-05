import {
  McpToolError,
  type PartyService,
  type McpService,
  type PrepareWriteInput,
  type WriteOperation,
  type PartyView,
  type CreatePartyInput,
  type AddExpenseInput,
} from "@trizum/mcp/index";
import { partyViewSchema } from "@trizum/mcp/contracts";
import { z } from "zod";
import type { McpAnalyticsEvent } from "@trizum/analytics";
import type { WriteTokens } from "./writeTokens";

const receiptSchema = z.object({ partyId: z.string().min(1) });

/** Claim before touching sync; ambiguous failures stay claimed to prevent duplicate writes. */
interface WriteOptions {
  tokens: WriteTokens;
  limitWrite: () => Promise<void>;
  trackEvent?: (event: McpAnalyticsEvent) => void;
}

export class IdempotentPartyService implements McpService {
  constructor(
    private readonly service: PartyService,
    private readonly db: D1Database,
    private readonly options: WriteOptions,
  ) {}

  async prepareWrite(input: PrepareWriteInput) {
    await this.options.limitWrite();

    return this.options.tokens.prepare(input.operation);
  }

  async getParty(partyId: string) {
    const result = await this.service.getParty(partyId);
    this.track("mcp_party_viewed");

    return result;
  }
  createParty(input: CreatePartyInput) {
    return this.once("create_party", input, () => this.service.createParty(input));
  }
  addExpense(input: AddExpenseInput) {
    return this.once("add_expense", input, () => this.service.addExpense(input));
  }

  private async once(
    tool: WriteOperation,
    input: CreatePartyInput | AddExpenseInput,
    operation: () => Promise<PartyView>,
  ): Promise<PartyView> {
    await this.options.limitWrite();
    const requestKey = await this.options.tokens.verify(input.requestId, tool);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([tool, input])),
    );

    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const claim = await this.db
      .prepare(
        "INSERT INTO mcp_operations (request_id, fingerprint) VALUES (?, ?) ON CONFLICT DO NOTHING",
      )
      .bind(requestKey, fingerprint)
      .run();

    if (claim.meta.changes === 0) {
      const existing = await this.db
        .prepare("SELECT fingerprint, result FROM mcp_operations WHERE request_id = ?")
        .bind(requestKey)
        .first<{ fingerprint: string; result: string | null }>();

      if (!existing || existing.fingerprint !== fingerprint)
        throw new McpToolError(
          "This requestId belongs to a different action. Call prepare_write for a new action.",
        );

      if (!existing.result)
        throw new McpToolError(
          "This action is still in progress or its outcome is unconfirmed. Do not retry it with a new requestId; check the party in trizum first.",
        );

      const receipt = receiptSchema.parse(JSON.parse(existing.result));

      // The original action is already complete. Read its current Automerge
      // state without recording another action or keeping a second data copy.
      return this.service.getParty(receipt.partyId);
    }

    const result = partyViewSchema.parse(await operation());
    await this.db
      .prepare("UPDATE mcp_operations SET result = ? WHERE request_id = ? AND fingerprint = ?")
      .bind(JSON.stringify({ partyId: result.partyId }), requestKey, fingerprint)
      .run();

    this.track(tool === "create_party" ? "mcp_party_created" : "mcp_expense_added");

    return result;
  }

  private track(event: McpAnalyticsEvent) {
    try {
      this.options.trackEvent?.(event);
    } catch {
      /* Analytics must not affect a completed action. */
    }
  }
}

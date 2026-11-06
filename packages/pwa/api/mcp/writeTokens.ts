import { SignJWT, jwtVerify, errors } from "jose";
import { z } from "zod";
import { prepareWriteSchema } from "@trizum/mcp/contracts";
import { McpToolError, type PreparedWrite, type WriteOperation } from "@trizum/mcp/index";

export const WRITE_WINDOW_MS = 15 * 60_000;
const issuer = "trizum:mcp:writes";

const claimsSchema = z.object({
  jti: z.uuid(),
  operation: prepareWriteSchema.shape.operation,
});

/** Signed deadlines survive receipt deletion without storing permanent tombstones. */
export class WriteTokens {
  constructor(
    private readonly secret: string | undefined,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private key() {
    if (!this.secret || this.secret.length < 32)
      throw new McpToolError("Write preparation is not configured. Please try again later.");

    return new TextEncoder().encode(`trizum-mcp-write-v1:${this.secret}`);
  }

  async prepare(operation: WriteOperation): Promise<PreparedWrite> {
    const issuedAt = Math.floor(this.now() / 1000);
    const expiresAt = issuedAt + WRITE_WINDOW_MS / 1000;

    const requestId = await new SignJWT({ operation })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(issuer)
      .setJti(crypto.randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.key());

    return { requestId, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  async verify(requestId: string, operation: WriteOperation): Promise<string> {
    const key = this.key();

    try {
      const { payload } = await jwtVerify(requestId, key, {
        algorithms: ["HS256"],
        issuer,
        audience: issuer,
        currentDate: new Date(this.now()),
        requiredClaims: ["exp", "iat", "jti"],
        maxTokenAge: "15m",
      });

      const claims = claimsSchema.parse(payload);

      if (claims.operation !== operation) throw new Error("Operation mismatch");

      return claims.jti;
    } catch (error) {
      if (error instanceof errors.JWTExpired)
        throw new McpToolError(
          "This write request has expired. Check the party before preparing a new action; do not repeat an unconfirmed write.",
        );
      throw new McpToolError(
        "Invalid write request. Call prepare_write for the intended operation and reuse its token unchanged on retries.",
      );
    }
  }
}

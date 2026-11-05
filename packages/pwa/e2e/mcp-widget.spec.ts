/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

interface HostMessage {
  id?: number;
  method?: string;
  result?: unknown;
  params?: unknown;
  error?: { code: number; message: string };
}

const party = {
  partyId: "party",
  url: "https://trizum.app/party/party",
  name: "Weekend",
  description: "Shared expenses",
  symbol: "🏝️",
  currency: "EUR",
  participants: [{ id: "alice", name: "Alice", archived: false, balance: "6.66" }],
  expenses: [],
};

for (const outcome of ["success", "rejected", "unsupported"] as const) {
  test(`MCP widget handoff with popups disabled: ${outcome}`, async ({ page, context }) => {
    const widgetScript = await readFile(
      new URL("../../mcp/dist/widget.js", import.meta.url),
      "utf8",
    );

    await page.setContent(
      '<iframe title="trizum" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>',
    );
    await page.evaluate(
      ({ widgetScript, party, outcome }) => {
        const frame = document.querySelector("iframe")!;
        window.addEventListener("message", (event) => {
          if (event.source !== frame.contentWindow) return;
          const message = event.data;

          const send = (data: HostMessage) =>
            frame.contentWindow!.postMessage({ jsonrpc: "2.0", ...data }, "*");

          if (message.method === "ui/initialize") {
            send({
              id: message.id,
              result: {
                protocolVersion: message.params.protocolVersion,
                hostInfo: { name: "sandbox-test-host", version: "1" },
                hostCapabilities: outcome === "unsupported" ? {} : { openLinks: {} },
                hostContext: { theme: "light" },
              },
            });
          }

          if (message.method === "ui/notifications/initialized") {
            send({
              method: "ui/notifications/tool-result",
              params: {
                content: [],
                structuredContent: party,
                _meta: {
                  locale: "en",
                  openLabel: "Open in trizum",
                  openErrorLabel: "Copy this link into your browser:",
                  expensesLabel: "Recent expenses",
                  balancesLabel: "Balances",
                },
              },
            });
          }

          if (message.method === "ui/open-link") {
            document.body.dataset.requestedUrl = message.params.url;

            if (outcome === "unsupported") {
              send({ id: message.id, error: { code: -32601, message: "Not supported" } });
            } else {
              send({ id: message.id, result: { isError: outcome === "rejected" } });
            }
          }
        });
        frame.srcdoc = `<!doctype html><div id="root"></div><script>${widgetScript.replaceAll("</script", "<\\/script")}</script>`;
      },
      { widgetScript, party, outcome },
    );

    const frame = page.frameLocator('iframe[title="trizum"]');
    await expect(frame.getByRole("heading", { name: "🏝️ Weekend" })).toBeVisible();
    await frame.getByRole("button", { name: "Open in trizum" }).click();

    if (outcome === "success") {
      await expect(page.locator("body")).toHaveAttribute("data-requested-url", party.url);
      await expect(frame.getByRole("alert")).toHaveCount(0);
    } else {
      await expect(frame.getByRole("alert")).toContainText("Copy this link into your browser:");
      await expect(frame.getByRole("alert")).toContainText(party.url);
    }

    await expect(frame.getByRole("button", { name: "Open in trizum" })).toBeEnabled();
    expect(context.pages()).toHaveLength(1);
    await expect(page.locator("iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms",
    );
  });
}

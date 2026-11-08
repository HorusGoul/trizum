/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createWidgetHtml } from "@trizum/mcp/widgetHtml";

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
  expenses: [{ id: "dinner", name: "Dinner", amount: "10.00", paidAt: "2026-11-06T20:00:00Z" }],
};

for (const outcome of ["success", "rejected", "unsupported"] as const) {
  test(`MCP widget handoff with popups disabled: ${outcome}`, async ({ page, context }) => {
    const [script, styles, sprite] = await Promise.all(
      ["js", "css", "svg"].map((extension) =>
        readFile(new URL(`../../mcp/dist/widget.${extension}`, import.meta.url), "utf8"),
      ),
    );

    const widgetHtml = createWidgetHtml({ script, styles, sprite });
    const theme = outcome === "success" ? "dark" : "light";
    const locale = outcome === "rejected" ? "es" : "en";
    const openLabel = locale === "es" ? "Abrir en trizum" : "Open in trizum";
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
    await page.setViewportSize({ width: 375, height: 800 });

    await page.setContent(
      '<iframe title="trizum" style="width:100%;height:700px;border:0" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>',
    );
    await page.evaluate(
      ({ widgetHtml, party, outcome, theme, locale, openLabel }) => {
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
                hostContext: { theme },
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
                  locale,
                  openLabel,
                  openErrorLabel: "Copy this link into your browser:",
                  expensesLabel: locale === "es" ? "Gastos recientes" : "Recent expenses",
                  balancesLabel: locale === "es" ? "Balance" : "Balances",
                },
              },
            });
          }

          if (message.method === "ui/open-link") {
            document.body.dataset.requestedUrl = message.params.url;
            document.body.dataset.openLinkCount = String(
              Number(document.body.dataset.openLinkCount ?? 0) + 1,
            );

            if (outcome === "success") {
              document.body.dataset.openLinkId = String(message.id);
            } else if (outcome === "unsupported") {
              send({ id: message.id, error: { code: -32601, message: "Not supported" } });
            } else {
              send({ id: message.id, result: { isError: outcome === "rejected" } });
            }
          }
        });
        frame.srcdoc = widgetHtml;
      },
      { widgetHtml, party, outcome, theme, locale, openLabel },
    );

    const frame = page.frameLocator('iframe[title="trizum"]');
    await expect(frame.getByRole("heading", { name: "🏝️ Weekend" })).toBeVisible();
    await expect(frame.locator("html")).toHaveAttribute("lang", locale);
    await expect(frame.locator("html")).toHaveCSS("color-scheme", theme);
    await expect(frame.locator("main")).toHaveCSS("border-radius", "24px");
    expect(
      await frame.locator("main").evaluate(async () => {
        await document.fonts.ready;

        return [...document.fonts].some(
          (font) =>
            font.family.replaceAll('"', "") === "Inter Variable" && font.status === "loaded",
        );
      }),
    ).toBe(true);
    await expect(frame.locator("li").filter({ hasText: "Alice" })).toContainText(
      locale === "es" ? "6,66" : "6.66",
    );
    await expect(
      frame.getByRole("heading", {
        name: locale === "es" ? "Gastos recientes" : "Recent expenses",
      }),
    ).toBeVisible();
    const button = frame.getByRole("button", { name: openLabel });
    const icon = button.locator("svg");
    expect(
      await icon.evaluate((element) =>
        element instanceof SVGSVGElement ? element.getBBox().width : 0,
      ),
    ).toBeGreaterThan(0);
    await button.focus();
    await page.keyboard.press("Enter");

    if (outcome === "success") {
      await expect(page.locator("body")).toHaveAttribute("data-requested-url", party.url);
      await expect(button).toHaveAttribute("data-pending", "true");
      const spinner = button.locator('svg use[href="#lucide.loader-circle"]');
      await expect(spinner).toHaveCount(1);
      await expect(button).toBeFocused();
      await page.keyboard.press("Enter");
      await page.evaluate(() => {
        document.querySelector("iframe")!.contentWindow!.postMessage(
          {
            jsonrpc: "2.0",
            id: Number(document.body.dataset.openLinkId),
            result: { isError: false },
          },
          "*",
        );
      });
      await expect(button).not.toHaveAttribute("data-pending", "true");
      await expect(page.locator("body")).toHaveAttribute("data-open-link-count", "1");
      await expect(frame.getByRole("alert")).toHaveCount(0);
    } else {
      await expect(frame.getByRole("alert")).toContainText("Copy this link into your browser:");
      await expect(frame.getByRole("alert")).toContainText(party.url);
    }

    await expect(button).toBeEnabled();
    await page.evaluate(() => {
      document.querySelector("iframe")!.contentWindow!.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/host-context-changed",
          params: { theme: "light" },
        },
        "*",
      );
    });
    await expect(frame.locator("html")).toHaveCSS("color-scheme", "light");
    expect(
      await frame.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]);
    expect(context.pages()).toHaveLength(1);
    await expect(page.locator("iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms",
    );
  });
}

import { expect, test } from "vite-plus/test";
import { sentryDocumentIdRedaction } from "./sentry.js";

test("removes console styling from the reported AdMob breadcrumb", () => {
  const args = [
    "%c09:35:58.704 %cERR%c %ctrizum·pwa·components·AdvertisingController %cAdMob operation failed",
    "color: gray;",
    "background-color: red; color: white;",
    "background-color: default;",
    "color: gray;",
    "color: default;",
  ];
  const breadcrumb = {
    category: "console",
    level: "error" as const,
    message: args.join(" "),
    data: { arguments: args, logger: "console" },
  };
  const cleaned = sentryDocumentIdRedaction.beforeBreadcrumb(breadcrumb);
  expect(cleaned.message).toBe(
    "09:35:58.704 ERR trizum·pwa·components·AdvertisingController AdMob operation failed",
  );
  expect(cleaned.data?.arguments).toEqual([cleaned.message]);
  expect(breadcrumb.data.arguments).toEqual(args);
});

test("preserves non-style arguments and redacts them without mutating the input", () => {
  const details = { documentId: "private", code: 7 };
  const cleaned = sentryDocumentIdRedaction.beforeBreadcrumb({
    category: "console",
    data: { arguments: ["%s %cfailed%c %o", "load", "color: red", "", details, "tail"] },
  });
  expect(cleaned.data?.arguments).toEqual([
    "%s failed %o",
    "load",
    { documentId: "[REDACTED_DOCUMENT_ID]", code: 7 },
    "tail",
  ]);
  expect(details.documentId).toBe("private");
});

test.each([
  { category: "console", message: "literal %%c", data: { arguments: ["literal %%c", "text"] } },
  { category: "console", message: "missing %c", data: { arguments: ["missing %c"] } },
  { category: "console", message: "plain", data: { arguments: ["plain", { code: 7 }] } },
  { category: "console", message: "%c without arguments" },
  { category: "navigation", message: "%c route", data: { arguments: ["%c route", "color: red"] } },
])("preserves breadcrumbs without console style arguments: $message", (breadcrumb) => {
  expect(sentryDocumentIdRedaction.beforeBreadcrumb(breadcrumb)).toEqual(breadcrumb);
});

import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  getPaymentLink,
  getPaymentMethods,
  normalizePaymentMethods,
  validatePaymentMethod,
} from "./paymentMethods.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";

beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("payment profiles", () => {
  it.each<{ type: PaymentMethodType; value: string; url: string }>([
    { type: "paypal", value: " Alice123 ", url: "https://paypal.me/Alice123" },
    { type: "paypal", value: "paypal.me/Alice123/", url: "https://paypal.me/Alice123" },
    { type: "paypal", value: "https://www.paypal.me/Alice123", url: "https://paypal.me/Alice123" },
    { type: "revolut", value: "@alice123", url: "https://revolut.me/alice123" },
    { type: "revolut", value: "https://revolut.me/alice123", url: "https://revolut.me/alice123" },
    { type: "venmo", value: "@alice-smith", url: "https://venmo.com/u/alice-smith" },
    { type: "venmo", value: "venmo.com/u/alice-smith", url: "https://venmo.com/u/alice-smith" },
    { type: "cash-app", value: "$Alice123", url: "https://cash.app/$Alice123" },
    { type: "cash-app", value: "https://cash.app/$Alice123", url: "https://cash.app/$Alice123" },
  ])("creates a canonical $type link from $value", ({ type, value, url }) => {
    expect(getPaymentLink(type, value)).toBe(url);
    expect(validatePaymentMethod(type, value)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "http://paypal.me/alice",
    "https://paypal.me.evil.test/alice",
    "https://paypal.me@evil.test/alice",
    "https://evil.test@paypal.me/alice",
    "https://paypal.me:123/alice",
    "https://paypal.me/alice?redirect=evil",
    "https://paypal.me/alice#other",
    "https://paypal.me/alice/10USD",
    "https://paypal.me/%61lice",
    "https://revolut.me/alice",
    "alice@example.com",
    "alice/smith",
    "alice smith",
  ])("rejects unsafe or unsupported PayPal input %s", (input) => {
    expect(getPaymentLink("paypal", input)).toBeNull();
    expect(validatePaymentMethod("paypal", input)).toBeTruthy();
  });

  it.each<PaymentMethodType>(["bizum", "bank-transfer", "other"])(
    "keeps %s instructions as text, even when they contain a URL",
    (type) => expect(getPaymentLink(type, "https://example.com/pay")).toBeNull(),
  );
});

it("preserves legacy Bizum contacts and does not resurrect removed methods", () => {
  expect(getPaymentMethods({ phone: " +34612345678 " })).toEqual({ bizum: "+34612345678" });
  expect(getPaymentMethods({ phone: "" })).toEqual({});
  expect(getPaymentMethods({ phone: "+34612345678", paymentMethods: {} })).toEqual({});
  expect(getPaymentMethods({ phone: "+34612345678", paymentMethods: { venmo: "alice" } })).toEqual({
    venmo: "alice",
  });
});

it("trims receiving details and preserves multi-line instructions", () => {
  expect(
    normalizePaymentMethods({
      bizum: " +34612345678 ",
      paypal: "Alice123",
      "bank-transfer": " Alice Smith\nES00 1234 ",
      other: " Wise: alice@example.com ",
      venmo: " ",
    }),
  ).toEqual({
    bizum: "+34612345678",
    paypal: "https://paypal.me/Alice123",
    "bank-transfer": "Alice Smith\nES00 1234",
    other: "Wise: alice@example.com",
  });
});

it("requires details for an added method and limits instruction length", () => {
  expect(validatePaymentMethod("other", "  ")).toBeTruthy();
  expect(validatePaymentMethod("other", "x".repeat(1001))).toBeTruthy();
  expect(validatePaymentMethod("bizum", "1".repeat(21))).toBeTruthy();
  expect(validatePaymentMethod("other", "Send using Wise: alice@example.com")).toBeNull();
});

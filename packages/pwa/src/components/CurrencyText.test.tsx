import { describe, expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrencyText } from "./CurrencyText.tsx";

describe("CurrencyText", () => {
  test("formats currency amounts with the Spanish locale", () => {
    const markup = renderToStaticMarkup(<CurrencyText amount={1234} currency="EUR" />);

    expect(markup).toContain("12,34\u00A0€");
  });

  test("formats currency amounts without a currency symbol", () => {
    const markup = renderToStaticMarkup(
      <CurrencyText amount={1234} currency="EUR" format="0.00" />,
    );

    expect(markup).toContain("12,34");
    expect(markup).not.toContain("€");
  });

  test("formats currencies with non-decimal Dinero metadata as app decimal amounts", () => {
    const markup = renderToStaticMarkup(<CurrencyText amount={1234} currency="MGA" />);

    expect(markup).toContain("12,34");
    expect(markup).toContain("MGA");
  });
});

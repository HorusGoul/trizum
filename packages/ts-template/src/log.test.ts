import { describe, expect, test } from "vitest";
import { configureTemplateLogging, getLogger, rootLogger } from "./log.js";

describe("@trizum/ts-template logging", () => {
  test("creates package-scoped loggers", () => {
    expect(rootLogger.category).toEqual(["trizum", "ts-template"]);
    expect(getLogger("feature").category).toEqual([
      "trizum",
      "ts-template",
      "feature",
    ]);
  });

  test("configures template logging through the shared facade", () => {
    expect(() =>
      configureTemplateLogging({
        lowestLevel: "debug",
        reset: true,
      }),
    ).not.toThrow();
  });
});

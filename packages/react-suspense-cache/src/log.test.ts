import { describe, expect, test } from "vite-plus/test";
import { getLogger, rootLogger } from "./log.js";

describe("react-suspense-cache logging", () => {
  test("uses the package logging category", () => {
    expect(rootLogger.category).toEqual(["trizum", "react-suspense-cache"]);
    expect(getLogger("createCache").category).toEqual([
      "trizum",
      "react-suspense-cache",
      "createCache",
    ]);
  });
});

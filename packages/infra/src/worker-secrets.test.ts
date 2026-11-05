import { expect, it } from "vite-plus/test";
import { inheritSecrets } from "./worker-secrets.js";

it("inherits external text and key secrets without replacing non-secret bindings", () => {
  expect(
    inheritSecrets([
      { type: "secret_text", name: "BETTER_AUTH_SECRET" },
      { type: "secret_key", name: "SIGNING_KEY" },
      { type: "plain_text", name: "BETTER_AUTH_URL" },
      { type: "d1", name: "DB" },
    ]),
  ).toEqual([
    { type: "inherit", name: "BETTER_AUTH_SECRET" },
    { type: "inherit", name: "SIGNING_KEY" },
  ]);
});

it("refuses adoption when the existing authentication secret is absent", () => {
  expect(() => inheritSecrets([])).toThrow("BETTER_AUTH_SECRET");
});

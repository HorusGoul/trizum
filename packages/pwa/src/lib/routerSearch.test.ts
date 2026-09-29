import { describe, expect, it } from "vite-plus/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { parseAppSearch, stringifyAppSearch } from "./routerSearch.ts";
import { parseRedemptionSearch } from "./premium/premiumRedemption.ts";

describe("opaque code search values", () => {
  it.each([
    "123E45",
    "12345678",
    "123456789012345678901234567890",
    "001234",
    "true",
    "null",
    "A+B&CODE",
  ])("preserves %s through route matching and generated URLs", async (code) => {
    const root = createRootRoute();
    const redeem = createRoute({
      getParentRoute: () => root,
      path: "/redeem",
      validateSearch: parseRedemptionSearch,
    });
    const router = createRouter({
      routeTree: root.addChildren([redeem]),
      history: createMemoryHistory({
        initialEntries: [`/redeem?${new URLSearchParams({ code })}`],
      }),
      parseSearch: parseAppSearch,
      stringifySearch: stringifyAppSearch,
    });
    await router.load();
    expect(router.state.matches.at(-1)?.search).toEqual({ code });
    const generated = router.buildLocation({ to: "/redeem", search: { code } });
    expect(new URLSearchParams(generated.searchStr).get("code")).toBe(code);
    expect(parseAppSearch(generated.searchStr)).toEqual({ code });
  });

  it("keeps normal structured search behavior and rejects duplicate codes", () => {
    const search = { page: 2, filter: { active: true }, ids: [1, 2] };
    expect(parseAppSearch(stringifyAppSearch(search))).toEqual(search);
    expect(parseRedemptionSearch(parseAppSearch("?code=ONE&code=TWO"))).toEqual({ code: "" });
    expect(stringifyAppSearch({})).toBe("");
  });
});

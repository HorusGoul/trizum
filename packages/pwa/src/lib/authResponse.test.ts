import { describe, expect, it } from "vite-plus/test";
import {
  getAuthRedirectUrl,
  getAuthResultToken,
  getAuthResultUser,
  readRememberedAuthUser,
} from "./authResponse.ts";

describe("auth response decoding", () => {
  it("keeps public user fields and discards session secrets", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");

    const user = getAuthResultUser({
      user: {
        id: "user-1",
        email: "alex@example.com",
        createdAt,
        updatedAt: "invalid",
        token: "secret",
      },
      token: "session-secret",
    });

    expect(user).toEqual({
      id: "user-1",
      email: "alex@example.com",
      name: "",
      emailVerified: false,
      image: null,
      createdAt,
      updatedAt: new Date(0),
    });
    expect(readRememberedAuthUser(user)).toEqual(user);
  });

  it.each([null, 123, { user: null }, { user: { id: 1, email: "alex@example.com" } }])(
    "rejects malformed identity %j",
    (value) => {
      expect(getAuthResultUser(value)).toBeUndefined();
      expect(readRememberedAuthUser(value)).toBeNull();
    },
  );

  it("extracts only string token and redirect fields", () => {
    expect(getAuthResultToken({ token: "session" })).toBe("session");
    expect(getAuthResultToken({ token: 123 })).toBeUndefined();
    expect(getAuthRedirectUrl({ url: "https://accounts.example/authorize" })).toBe(
      "https://accounts.example/authorize",
    );
    expect(getAuthRedirectUrl({ url: false })).toBeUndefined();
  });
});

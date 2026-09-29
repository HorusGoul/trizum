// @vitest-environment jsdom

import { act, createRef, useImperativeHandle, type Ref } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import { useRedemptionDialogs } from "./useRedemptionDialogs.ts";

vi.mock("sonner", () => ({ toast: { error: vi.fn<typeof toast.error>() } }));
let root: Root;
let container: HTMLDivElement;
const dialogHandle = createRef<ReturnType<typeof useRedemptionDialogs>>();

function dialogs() {
  if (!dialogHandle.current) throw new Error("Dialog probe is not mounted");
  return dialogHandle.current;
}
const dismissals: Array<() => void> = [];
const presentPaywall = vi.fn<() => Promise<void>>();

function Probe({
  userId,
  isNative,
  ref,
}: {
  userId: string | null;
  isNative: boolean;
  ref: Ref<ReturnType<typeof useRedemptionDialogs>>;
}) {
  const value = useRedemptionDialogs({ userId, isNative, presentPaywall });
  useImperativeHandle(ref, () => value, [value]);
  return <output>{value.dialog.kind}</output>;
}

async function render(userId: string | null = null, isNative = true) {
  await act(async () => {
    root.render(<Probe ref={dialogHandle} userId={userId} isNative={isNative} />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  i18n.load("en", {});
  i18n.activate("en");
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  dismissals.length = 0;
  presentPaywall.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        dismissals.push(resolve);
      }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

it("waits for completed sign-in and the matching provider account before native Premium", async () => {
  await render();
  await act(async () => dialogs().openPremium());
  expect(dialogs().dialog).toEqual({ kind: "signIn", intent: "premium" });
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => {
    dialogs().signedIn("account-a");
    dialogs().close();
  });
  expect(dialogs().dialog).toEqual({ kind: "premium", userId: "account-a" });
  await render("account-b");
  expect(presentPaywall).not.toHaveBeenCalled();
  await render("account-a");
  expect(presentPaywall).toHaveBeenCalledTimes(1);
  expect(container.textContent).toBe("premium");
  await act(async () => dismissals[0]());
  expect(container.textContent).toBe("closed");
});

it("completes optional account sign-in without opening Premium", async () => {
  await render();
  await act(async () => dialogs().signIn());
  await act(async () => {
    dialogs().signedIn("account-a");
    dialogs().close();
  });
  await render("account-a");
  expect(dialogs().dialog.kind).toBe("closed");
  expect(presentPaywall).not.toHaveBeenCalled();
});

it("cancels pending sign-in, ignores late completion, and allows a fresh attempt", async () => {
  await render();
  await act(async () => dialogs().openPremium());
  await act(async () => dialogs().close());
  await act(async () => dialogs().signedIn("account-a"));
  expect(dialogs().dialog.kind).toBe("closed");
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => dialogs().openPremium());
  await act(async () => {
    dialogs().signedIn("account-a");
    dialogs().close();
  });
  await render("account-a");
  expect(presentPaywall).toHaveBeenCalledTimes(1);
});

it("can sign in to the same account and open Premium on successive attempts", async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await render();
    await act(async () => dialogs().openPremium());
    await act(async () => {
      dialogs().signedIn("account-a");
      dialogs().close();
    });
    await render("account-a");
    expect(presentPaywall).toHaveBeenCalledTimes(attempt + 1);
    await act(async () => dismissals[attempt]());
    expect(dialogs().dialog.kind).toBe("closed");
  }
});

it("does not let a stale paywall completion close a newer request", async () => {
  await render("account-a");
  await act(async () => dialogs().openPremium());
  await act(async () => dialogs().openPremium());
  expect(presentPaywall).toHaveBeenCalledTimes(2);
  await act(async () => dismissals[0]());
  expect(dialogs().dialog.kind).toBe("premium");
  await act(async () => dismissals[1]());
  expect(dialogs().dialog.kind).toBe("closed");
});

it("opens browser help without sign-in or native commerce", async () => {
  await render(null, false);
  await act(async () => dialogs().openPremium());
  expect(dialogs().dialog.kind).toBe("browserHelp");
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => dialogs().close());
  expect(dialogs().dialog.kind).toBe("closed");
});

it("clears a failed request and allows retry", async () => {
  presentPaywall.mockRejectedValueOnce(new Error("Unavailable"));
  await render("account-a");
  await act(async () => dialogs().openPremium());
  expect(dialogs().dialog.kind).toBe("closed");
  expect(toast.error).toHaveBeenCalledWith("Could not open Premium. Please try again.");
  await act(async () => dialogs().openPremium());
  expect(presentPaywall).toHaveBeenCalledTimes(2);
  expect(dialogs().dialog.kind).toBe("premium");
});

it("ignores callbacks from a cancelled sign-in after starting another attempt", async () => {
  await render();
  await act(async () => dialogs().openPremium());
  const cancelledAttempt = dialogs();
  await act(async () => dialogs().close());
  await act(async () => dialogs().openPremium());
  await act(async () => {
    cancelledAttempt.signedIn("old-account");
    cancelledAttempt.close();
  });
  expect(dialogs().dialog).toEqual({ kind: "signIn", intent: "premium" });
  await act(async () => {
    dialogs().signedIn("new-account");
    dialogs().close();
  });
  await render("new-account");
  expect(presentPaywall).toHaveBeenCalledTimes(1);
});

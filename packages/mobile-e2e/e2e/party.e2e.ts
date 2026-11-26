import { describe, test } from "@e2e-dev/mobile";
import { expect } from "e2e";
import { textField } from "./fields.js";
import { closeKeyboard } from "./keyboard.js";

describe("party", () => {
  test("a new party records its first expense", async ({ app, device, platform, screen }) => {
    await app.clearState();

    await screen.getByText("Create a Party").tap({ timeout: 20_000 });
    await textField(screen, "Name").fill("Bench trip");
    await closeKeyboard({ platform, screen, device });
    await screen.scrollUntilVisible(screen.getByRole("button", "Add participant"));
    await textField(screen, "Participant name").fill("Alice");
    await textField(screen, "New participant name").fill("Bob");
    await screen.getByRole("button", "Add participant").tap();
    await screen.getByRole("button", "Save").tap();

    await expect(screen.getByText("Who are you?")).toBeVisible();
    await screen.getByText("Alice").first().tap();
    await screen.getByRole("button", "Save").tap();

    // The "Party created" and welcome toasts overlap the floating add button.
    // A touch pauses their timers for good, so tap the button's uncovered edge.
    const addExpense = screen.getByRole("button", "Add an expense");
    const box = await addExpense.boundingBox();

    if (!box) throw new Error("The add expense button has no frame");
    await addExpense.tap({ position: { x: box.width * 0.93, y: box.height / 2 } });

    await textField(screen, "Title").fill("Groceries");
    await textField(screen, "Amount").fill("42.50");
    await closeKeyboard({ platform, screen, device });
    // iOS reads the toggle as a switch, Android as a checkbox.
    await screen
      .getByRole("switch", "Include all")
      .or(screen.getByRole("checkbox", "Include all"))
      .tap();
    await screen.getByRole("button", "Save").tap();

    await expect(screen.getByText("New expense")).toBeHidden();
    await expect(screen.getByText("Groceries").first()).toBeVisible();
  });
});

import { createBrowserHistory } from "@tanstack/react-router";
import { createSheetNavigation } from "../../src/lib/sheetNavigation";

// Minimal browser boundary: real history/controller, ordinary DOM draft, no app services.
document.body.innerHTML = `
  <label>Expense draft<input id="draft"></label>
  <button id="open">Open suggestions</button>
  <button id="locked">Open locked sheet</button>
  <button id="navigate">Navigate to settings</button>
  <button id="replace">Replace with settings</button>
`;

const navigation = createSheetNavigation(() => createBrowserHistory());

function button(id: string) {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button ${id}`);

  return element;
}

function openSheet(name: string, locked = false) {
  const dialog = document.createElement("section");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", name);
  const close = document.createElement("button");
  close.textContent = "Close sheet";
  const unlock = document.createElement("button");
  unlock.textContent = "Unlock sheet";
  unlock.onclick = () => {
    locked = false;
  };

  dialog.append(close, unlock);
  document.body.append(dialog);

  const unregister = navigation.register(() => {
    if (locked) return false;
    dialog.remove();

    return true;
  });

  close.onclick = () => {
    unregister();
    dialog.remove();
  };
}

button("open").onclick = () => openSheet("Receipt suggestions");

button("locked").onclick = () => openSheet("Locked sheet", true);

button("navigate").onclick = () => navigation.history.push("/sheet-settings");

button("replace").onclick = () => navigation.history.replace("/sheet-settings");

export const HEADER_DURATION = 20;

export const palette = {
  bg: "#061b30",
  card: "#0a2d4b",
  surface: "#103a5c",
  line: "#2b628b",
  text: "#f2f9ff",
  muted: "#a2c6df",
  blue: "#3583cd",
  bright: "#79caff",
  coral: "#ff91a8",
  teal: "#76d8c5",
  ink: "#072744",
};

export const peopleColors = [palette.bright, palette.coral, palette.teal],
  peopleNames = ["Ana", "Ben", "Cora"],
  expenseAmounts = [6000, 3000, 3000],
  expenseStarts = [0.25, 3.45, 6.65];

export const balanceStates = [
  [0, 0, 0],
  [4000, -2000, -2000],
  [3000, 0, -3000],
  [2000, -1000, -1000],
  [1000, 0, -1000],
  [0, 0, 0],
];

export type Locale = "en" | "es";

export const creativeCopy = {
  en: {
    intro: "Split the good times.",
    labels: ["Dinner", "Taxi", "Tickets"],
    each: "per person",
    settle: "Settle up.",
    done: "All square.",
    back: "to receive",
    owes: "owes",
    even: "even",
    settled: "settled",
    total: "Trip total",
    expenses: "3 expenses",
  },
  es: {
    intro: "Comparte los gastos.",
    labels: ["Cena", "Taxi", "Entradas"],
    each: "por persona",
    settle: "Hora de saldar cuentas",
    done: "Todo saldado",
    back: "por recibir",
    owes: "debe",
    even: "al día",
    settled: "saldado",
    total: "Total del viaje",
    expenses: "3 gastos",
  },
};

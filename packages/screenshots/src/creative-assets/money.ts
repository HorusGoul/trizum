export function formatDemoMoney(v: number, sign = false) {
  return `${sign && v < 0 ? "−" : sign && v > 0 ? "+" : ""}${(Math.abs(v) / 100).toFixed(2).replace(".", ",")} €`;
}

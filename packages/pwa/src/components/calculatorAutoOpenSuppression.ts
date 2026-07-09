const CALCULATOR_AUTO_OPEN_SUPPRESSION_MS = 1500;
const CALCULATOR_AUTO_OPEN_POINTER_ALLOWANCE_MS = 500;

let suppressCalculatorAutoOpenUntil = 0;
let allowCalculatorAutoOpenUntil = 0;
let blockCalculatorAutoOpenUntilUserInteraction = false;

export function suppressCalculatorAutoOpen() {
  if (typeof performance === "undefined") {
    return;
  }

  allowCalculatorAutoOpenUntil = 0;
  blockCalculatorAutoOpenUntilUserInteraction = true;
  suppressCalculatorAutoOpenUntil = performance.now() + CALCULATOR_AUTO_OPEN_SUPPRESSION_MS;
}

export function isCalculatorAutoOpenSuppressed() {
  if (typeof performance === "undefined") {
    return false;
  }

  const now = performance.now();
  return (
    now >= allowCalculatorAutoOpenUntil &&
    (blockCalculatorAutoOpenUntilUserInteraction || now < suppressCalculatorAutoOpenUntil)
  );
}

export function allowCalculatorAutoOpenForUserInteraction() {
  if (typeof performance === "undefined") {
    return;
  }

  allowCalculatorAutoOpenUntil = performance.now() + CALCULATOR_AUTO_OPEN_POINTER_ALLOWANCE_MS;
  blockCalculatorAutoOpenUntilUserInteraction = false;
}

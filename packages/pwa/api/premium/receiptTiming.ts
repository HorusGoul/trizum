/** Numeric stage durations only; never attach receipt values or provider errors. */
export function createReceiptTiming() {
  const durations = new Map<string, number>();

  async function measure<T>(
    stage: "access" | "party" | "image" | "extraction" | "verification",
    task: () => Promise<T>,
  ) {
    const start = performance.now();

    try {
      return await task();
    } finally {
      durations.set(stage, performance.now() - start);
    }
  }

  return {
    measure,
    toHeader: () =>
      Array.from(durations, ([stage, duration]) => `${stage};dur=${duration.toFixed(1)}`).join(
        ", ",
      ),
  };
}

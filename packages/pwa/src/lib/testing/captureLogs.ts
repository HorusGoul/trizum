import { configurePwaLogging } from "../log.ts";
import type { LogRecord } from "@trizum/logging";

/** Capture through the configured sink, including production document-ID redaction. */
export function capturePwaLogs(sink: (record: LogRecord) => void) {
  configurePwaLogging({
    reset: true,
    lowestLevel: "debug",
    extraSinks: { capture: sink },
    surfaceSinks: ["capture"],
  });

  return () => configurePwaLogging({ reset: true, lowestLevel: null });
}

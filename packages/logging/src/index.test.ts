import { afterEach, describe, expect, test } from "vitest";
import {
  getConfig,
  resetSync,
  type ContextLocalStorage,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import {
  configureTrizumLogging,
  getTrizumCategory,
  getTrizumLogger,
  type TrizumLoggerConfig,
} from "./index.js";

function createRecordingSink() {
  const records: LogRecord[] = [];
  const sink: Sink = (record) => {
    records.push(record);
  };

  return { records, sink };
}

afterEach(() => {
  resetSync();
});

describe("@trizum/logging", () => {
  test("builds canonical trizum categories and logger hierarchies", () => {
    expect(getTrizumCategory("screenshots", "capture")).toEqual([
      "trizum",
      "screenshots",
      "capture",
    ]);

    const logger = getTrizumLogger("screenshots", "capture");

    expect(logger.category).toEqual(["trizum", "screenshots", "capture"]);
    expect(logger.parent?.category).toEqual(["trizum", "screenshots"]);
  });

  test("configures default surface and meta loggers", () => {
    const contextLocalStorage: ContextLocalStorage<Record<string, unknown>> = {
      run(_store, callback) {
        return callback();
      },
      getStore() {
        return undefined;
      },
    };

    configureTrizumLogging({
      surface: "screenshots",
      lowestLevel: "debug",
      contextLocalStorage,
      metaLowestLevel: "error",
    });

    const config = getConfig();

    expect(config).not.toBeNull();
    expect(Object.keys(config?.sinks ?? {})).toContain("console");
    expect(config?.contextLocalStorage).toBe(contextLocalStorage);
    expect(config?.loggers).toContainEqual({
      category: ["trizum", "screenshots"],
      lowestLevel: "debug",
      sinks: ["console"],
    });
    expect(config?.loggers).toContainEqual({
      category: ["logtape", "meta"],
      lowestLevel: "error",
      parentSinks: "override",
      sinks: ["console"],
    });
  });

  test("routes logs through configured surface sinks and extra loggers", () => {
    const surfaceLogs = createRecordingSink();
    const serverLogs = createRecordingSink();
    const extraLoggers: TrizumLoggerConfig<"surface" | "server">[] = [
      {
        category: getTrizumCategory("server"),
        lowestLevel: "warning",
        parentSinks: "override",
        sinks: ["server"],
      },
    ];

    configureTrizumLogging({
      surface: "screenshots",
      extraSinks: {
        surface: surfaceLogs.sink,
        server: serverLogs.sink,
      },
      surfaceSinks: ["surface"],
      extraLoggers,
    });

    getTrizumLogger("screenshots", "capture").info("Capture started", {
      device: "iphone-6.5",
    });
    getTrizumLogger("server", "api").info("This should be filtered out");
    getTrizumLogger("server", "api").warning("Server degraded", {
      route: "/health",
    });

    expect(surfaceLogs.records).toHaveLength(1);
    expect(surfaceLogs.records[0]).toMatchObject({
      category: ["trizum", "screenshots", "capture"],
      level: "info",
      properties: {
        device: "iphone-6.5",
      },
    });

    expect(serverLogs.records).toHaveLength(1);
    expect(serverLogs.records[0]).toMatchObject({
      category: ["trizum", "server", "api"],
      level: "warning",
      properties: {
        route: "/health",
      },
    });
  });

  test("does not reconfigure an existing setup unless reset is requested", () => {
    const firstSink = createRecordingSink();
    const secondSink = createRecordingSink();

    configureTrizumLogging({
      surface: "screenshots",
      extraSinks: { first: firstSink.sink },
      surfaceSinks: ["first"],
    });

    configureTrizumLogging({
      surface: "screenshots",
      extraSinks: { second: secondSink.sink },
      surfaceSinks: ["second"],
    });

    getTrizumLogger("screenshots").info("First config remains active");

    expect(firstSink.records).toHaveLength(1);
    expect(secondSink.records).toHaveLength(0);

    configureTrizumLogging({
      surface: "screenshots",
      extraSinks: { second: secondSink.sink },
      surfaceSinks: ["second"],
      reset: true,
    });

    getTrizumLogger("screenshots").info("Second config replaces the first");

    expect(firstSink.records).toHaveLength(1);
    expect(secondSink.records).toHaveLength(1);
    expect(secondSink.records[0]).toMatchObject({
      category: ["trizum", "screenshots"],
      level: "info",
    });
  });
});

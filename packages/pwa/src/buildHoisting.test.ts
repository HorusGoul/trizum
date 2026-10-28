import { spawnSync } from "node:child_process";
import { build } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import { expect, test } from "vite-plus/test";

test("preserves hoisted function aliases when building a top-level-await module", async () => {
  // Sentry's span helpers alias a function before its declaration. Losing hoisting
  // here crashes production initialization before React can render.
  const source = `
    const getRootSpan = getSegmentSpan;
    const getAsyncSpan = getSegmentSpanAsync;
    const getSpanIterator = iterateSpan;
    function getSegmentSpan(span) { return span; }
    async function getSegmentSpanAsync(span) { return span; }
    function* iterateSpan(span) { yield span; }
    const order = [];
    class Marker { static { order.push("class"); } }
    order.push("after");
    await Promise.resolve();
    export { getRootSpan, getSegmentSpan, getAsyncSpan, getSegmentSpanAsync, getSpanIterator, iterateSpan, Marker, order };
  `;
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "hoisting-regression-fixture",
        resolveId: (id) => (id === "virtual:hoisting" ? id : undefined),
        load: (id) => (id === "virtual:hoisting" ? source : undefined),
      },
      topLevelAwait(),
    ],
    build: {
      write: false,
      target: "esnext",
      minify: false,
      rolldownOptions: {
        input: "virtual:hoisting",
        preserveEntrySignatures: "strict",
        output: { format: "es" },
      },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!("output" in bundle)) throw new Error("Expected a completed fixture build");
  const output = bundle.output;
  const entry = output.find((chunk) => chunk.type === "chunk" && chunk.isEntry);
  expect(entry?.type).toBe("chunk");
  if (entry?.type !== "chunk") throw new Error("Missing regression fixture entry");
  const execution = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `const fixture = await import(${JSON.stringify("data:text/javascript;base64," + Buffer.from(entry.code).toString("base64"))});
       await fixture.__tla;
       if (fixture.getRootSpan(123) !== 123) throw new Error("sync alias lost");
       if (await fixture.getAsyncSpan(456) !== 456) throw new Error("async alias lost");
       if (fixture.getSpanIterator(789).next().value !== 789) throw new Error("generator alias lost");
       if (fixture.order.join(",") !== "class,after") throw new Error("class order changed");`,
    ],
    { encoding: "utf8" },
  );
  expect(execution.stderr).toBe("");
  expect(execution.status).toBe(0);
});

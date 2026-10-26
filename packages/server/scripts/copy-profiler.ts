import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const destination = process.argv[2];
if (!destination) {
  throw new Error("Usage: node scripts/copy-profiler.ts <node_modules destination>");
}

// Resolve from each consumer so the image uses the versions selected by pnpm.
const require = createRequire(import.meta.url);
const profilingRequire = createRequire(require.resolve("@sentry/profiling-node"));

function copyPackage(manifestPath: string, nodeModules: string) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name: string;
    dependencies?: Record<string, string>;
  };
  const target = resolve(nodeModules, manifest.name);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(dirname(manifestPath), target, { recursive: true });

  const dependencyRequire = createRequire(manifestPath);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    copyPackage(
      dependencyRequire.resolve(`${dependency}/package.json`),
      resolve(target, "node_modules"),
    );
  }
}

copyPackage(profilingRequire.resolve("@sentry/node-cpu-profiler/package.json"), destination);

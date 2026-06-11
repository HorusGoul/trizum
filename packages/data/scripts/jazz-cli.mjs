import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const jazzPackageJsonPath = require.resolve("jazz-tools/package.json");
const jazzPackageJson = require(jazzPackageJsonPath);
const jazzBin = join(dirname(jazzPackageJsonPath), jazzPackageJson.bin["jazz-tools"]);
const defaultAppId = "f3c88cf5-97c1-41fc-a6ba-ebb209719a61";
const defaultServerUrl = "https://v2.sync.jazz.tools/";

loadEnvFile(join(packageRoot, ".env"));

const command = process.argv[2];
const passthroughArgs = process.argv.slice(3);
const appId = readEnv("JAZZ_APP_ID", "VITE_JAZZ_APP_ID") ?? defaultAppId;
const serverUrl = readEnv("JAZZ_SERVER_URL", "VITE_JAZZ_SERVER_URL") ?? defaultServerUrl;
const commonArgs = [
  "--schema-dir",
  packageRoot,
  "--migrations-dir",
  join(packageRoot, "migrations"),
];

const commandArgs = getJazzArgs(command, passthroughArgs);

if (!commandArgs) {
  process.stderr.write(
    [
      "Usage: node scripts/jazz-cli.mjs <command> [args...]",
      "",
      "Commands:",
      "  validate",
      "  schema:hash",
      "  schema:export",
      "  permissions:status",
      "  migrations:create",
      "  migrations:push <fromHash> <toHash>",
      "  deploy",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [jazzBin, ...commandArgs], {
  cwd: packageRoot,
  env: {
    ...process.env,
    JAZZ_APP_ID: appId,
    JAZZ_SERVER_URL: serverUrl,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function getJazzArgs(name, args) {
  switch (name) {
    case "deploy":
      return ["deploy", appId, ...commonArgs, "--server-url", serverUrl, ...args];
    case "migrations:create":
      return ["migrations", "create", appId, ...commonArgs, "--server-url", serverUrl, ...args];
    case "migrations:push":
      return ["migrations", "push", appId, ...args, ...commonArgs, "--server-url", serverUrl];
    case "permissions:status":
      return ["permissions", "status", appId, ...commonArgs, "--server-url", serverUrl, ...args];
    case "schema:export":
      return ["schema", "export", ...commonArgs, ...args];
    case "schema:hash":
      return ["schema", "hash", "--schema-dir", packageRoot, ...args];
    case "validate":
      return ["validate", "--schema-dir", packageRoot, ...args];
    default:
      return null;
  }
}

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    process.env[key] ??= parseEnvValue(rawValue);
  }
}

function parseEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

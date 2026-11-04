import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reactDoctorConfig, { reactDoctorSettings } from "../../../../doctor.config.ts";

const fixtureDirectory = fileURLToPath(new URL(".", import.meta.url));
const packageDirectory = fileURLToPath(new URL("../../", import.meta.url));
const workspaceDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const reproductionDirectory = mkdtempSync(path.join(tmpdir(), "trizum-react-doctor-reproduction-"));

function installedVersion(packageName: string): string {
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, "node_modules", packageName, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}

writeFileSync(
  path.join(reproductionDirectory, "package.json"),
  JSON.stringify(
    {
      name: "trizum-react-doctor-reproduction",
      private: true,
      type: "module",
      dependencies: {
        "@capacitor/app": installedVersion("@capacitor/app"),
        react: installedVersion("react"),
        "react-dom": installedVersion("react-dom"),
      },
      devDependencies: { vite: installedVersion("vite") },
    },
    null,
    2,
  ),
);
symlinkSync(
  path.join(packageDirectory, "node_modules"),
  path.join(reproductionDirectory, "node_modules"),
  "dir",
);
const sourcePaths: string[] = [];
for (const fixture of readdirSync(fixtureDirectory)) {
  if (fixture.endsWith(".tsx.fixture")) {
    const sourcePath = path.join(reproductionDirectory, fixture.replace(/\.fixture$/, ""));
    sourcePaths.push(sourcePath);
    copyFileSync(path.join(fixtureDirectory, fixture), sourcePath);
  }
}

process.stderr.write(`Reproduction sources retained at ${reproductionDirectory}\n`);
if (process.argv.includes("--pwa-config")) {
  writeFileSync(
    path.join(reproductionDirectory, "doctor.config.json"),
    JSON.stringify(reactDoctorConfig),
  );
}
const oxlintConfigPath = path.join(reproductionDirectory, ".oxlintrc.json");
writeFileSync(
  oxlintConfigPath,
  JSON.stringify(
    {
      jsPlugins: [
        {
          name: "react-doctor",
          specifier: fileURLToPath(import.meta.resolve("oxlint-plugin-react-doctor")),
        },
      ],
      rules: {
        "react-doctor/effect-needs-cleanup": "error",
        "react-doctor/no-ref-current-in-render": "error",
        "react-doctor/no-hydration-branch-on-browser-global": "error",
        "react-doctor/no-unguarded-browser-global-in-render-or-hook-init": "error",
        ...(process.argv.includes("--pwa-config") ? reactDoctorConfig.rules : {}),
      },
      ...(process.argv.includes("--pwa-config")
        ? { settings: { "react-doctor": reactDoctorSettings } }
        : {}),
    },
    null,
    2,
  ),
);
const result = spawnSync(
  "vp",
  process.argv.includes("--oxlint")
    ? ["lint", "--config", oxlintConfigPath, "--format", "json", ...sourcePaths]
    : [
        "exec",
        "react-doctor",
        reproductionDirectory,
        "--no-score",
        "--json",
        "--blocking",
        "none",
        "--yes",
      ],
  {
    cwd: workspaceDirectory,
    encoding: "utf8",
    timeout: 30_000,
  },
);
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;

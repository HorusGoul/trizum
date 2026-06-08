import { readFileSync, writeFileSync } from "node:fs";

const agentsPath = new URL("../AGENTS.md", import.meta.url);
const source = readFileSync(agentsPath, "utf8");

const replacements = [
  [
    "- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.",
    "- [ ] Run `vp run check` and `vp run test` to format, lint, type check and test changes.",
  ],
  [
    "- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.",
    "- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <task-or-script>`.",
  ],
];

let nextSource = source;

for (const [from, to] of replacements) {
  if (!nextSource.includes(from) && !nextSource.includes(to)) {
    throw new Error(`Could not find expected Vite+ agent guidance line: ${from}`);
  }

  nextSource = nextSource.replace(from, to);
}

if (nextSource !== source) {
  writeFileSync(agentsPath, nextSource);
}

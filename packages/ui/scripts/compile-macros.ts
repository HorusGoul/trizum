import { readdir, readFile, writeFile } from "node:fs/promises";
import { transformAsync } from "@babel/core";
import linguiMacro from "@lingui/babel-plugin-lingui-macro";
import { getConfig } from "@lingui/conf";

const config = getConfig({ cwd: process.cwd(), configPath: "lingui.config.ts" });

// TypeScript emits JSX and declarations first; compile macros in the JS so
// consumers do not need the package's build-time tooling.
for (const file of await readdir("dist", { recursive: true })) {
  if (!file.endsWith(".js")) continue;
  const filename = `dist/${file}`;
  const source = await readFile(filename, "utf8");

  if (!source.includes("/macro")) continue;

  const result = await transformAsync(source, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [[linguiMacro, { linguiConfig: config }]],
  });

  if (!result?.code) throw new Error(`Unable to compile Lingui macros in ${filename}`);
  await writeFile(filename, result.code);
}

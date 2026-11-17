import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { afterEach, expect, it } from "vite-plus/test";
import metadata from "../submission/plugin.json" with { type: "json" };
import { buildSubmission } from "./submission.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "trizum-submission-"));
  directories.push(directory);
  const pkg = join(directory, "mcp");
  await mkdir(pkg);
  await cp(new URL("../submission/", import.meta.url), join(pkg, "submission"), {
    recursive: true,
  });
  const images = join(directory, "pwa/public");
  await mkdir(images, { recursive: true });

  for (const filename of ["pwa-64x64.png", "pwa-512x512.png"])
    await cp(new URL(`../../pwa/public/${filename}`, import.meta.url), join(images, filename));
  await writeFile(
    join(pkg, "package.json"),
    JSON.stringify({ name: "@trizum/mcp", version: "9.8.7" }),
  );
  await writeFile(
    join(pkg, "CHANGELOG.md"),
    "# MCP\n\n## 9.8.7\n\nPublish this version.\n\n## 9.8.6\n\nOlder changes.\n",
  );
  await writeFile(join(pkg, ".env"), "SECRET=never-in-the-archive");
  await writeFile(join(pkg, "unrelated.txt"), "Not a submission file");

  return pkg;
}

it("builds an uploadable ZIP with release metadata, selected images and a matching checksum", async () => {
  const directory = await fixture();
  const result = await buildSubmission(directory, "@trizum/mcp@9.8.7");
  const bytes = await readFile(result.archivePath);
  const files = unzipSync(bytes);
  expect(Object.keys(files).sort()).toEqual([
    "assets/icon.png",
    "assets/logo.png",
    "mcp.json",
    "plugin.json",
  ]);
  const manifest = JSON.parse(strFromU8(files["plugin.json"]));
  expect(manifest).toMatchObject({
    name: "trizum",
    version: "9.8.7",
    extensions: { "com.openai": { publication: { release_notes: "Publish this version." } } },
  });
  expect(manifest).not.toHaveProperty("apps");
  expect(manifest).not.toHaveProperty("hooks");
  expect(manifest.extensions["com.openai"].review.test_cases.positive).toHaveLength(5);
  expect(manifest.extensions["com.openai"].review.test_cases.negative).toHaveLength(3);
  expect(JSON.parse(strFromU8(files["mcp.json"]))).toMatchObject({
    mcpServers: {
      trizum: {
        type: "streamable-http",
        url: "https://trizum.app/api/mcp",
        extensions: { "com.openai": { auth: { type: "none" } } },
      },
    },
  });
  expect(Buffer.from(files["assets/logo.png"])).toEqual(
    await readFile(join(directory, "../pwa/public/pwa-512x512.png")),
  );
  expect(Buffer.from(files["assets/icon.png"])).toEqual(
    await readFile(join(directory, "../pwa/public/pwa-64x64.png")),
  );
  const digest = createHash("sha256").update(bytes).digest("hex");
  expect(await readFile(result.checksumPath, "utf8")).toBe(`${digest}  trizum-chatgpt-9.8.7.zip\n`);
  expect(result.needsDemoRecording).toBe(true);
  expect(await readFile(join(directory, "submission/plugin.json"), "utf8")).not.toContain(
    '"version"',
  );
});

it("produces the same archive on repeated builds", async () => {
  const directory = await fixture();
  const first = await buildSubmission(directory);
  const before = await readFile(first.archivePath);
  const second = await buildSubmission(directory);
  expect(await readFile(second.archivePath)).toEqual(before);
});

it.each(["@trizum/pwa@9.8.7", "@trizum/mcp@9.8.6"])(
  "rejects release/ref mismatches before writing an archive: %s",
  async (tag) => {
    const directory = await fixture();
    await expect(buildSubmission(directory, tag)).rejects.toThrow("does not match");
    await expect(
      readFile(join(directory, "artifacts/trizum-chatgpt-9.8.7.zip")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  },
);

it("requires a changelog entry for the release version", async () => {
  const directory = await fixture();
  await writeFile(join(directory, "CHANGELOG.md"), "# MCP\n\n## 9.8.6\nOlder changes.\n");
  await expect(buildSubmission(directory)).rejects.toThrow("Missing MCP changelog entry for 9.8.7");
});

it("rejects malformed listing metadata and incomplete review cases", async () => {
  const directory = await fixture();
  const config = structuredClone(metadata);
  config.extensions["com.openai"].interface.privacyPolicyURL = "http://trizum.app/privacy-policy";
  config.extensions["com.openai"].review.test_cases.positive.pop();
  await writeFile(join(directory, "submission/plugin.json"), JSON.stringify(config));
  await expect(buildSubmission(directory)).rejects.toThrow(/privacyPolicyURL|positive/);
});

it("rejects private server headers instead of serializing credentials", async () => {
  const directory = await fixture();
  await writeFile(
    join(directory, "submission/mcp.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        trizum: {
          type: "streamable-http",
          url: "https://trizum.app/api/mcp",
          headers: { Authorization: "private-token" },
          extensions: { "com.openai": { auth: { type: "none" } } },
        },
      },
    }),
  );
  await expect(buildSubmission(directory)).rejects.toThrow(/headers/);
});

it("requires every referenced image and rejects unsafe archive paths", async () => {
  const directory = await fixture();
  await writeFile(
    join(directory, "submission/assets.json"),
    JSON.stringify({ "assets/icon.png": "../pwa/public/pwa-64x64.png" }),
  );
  await expect(buildSubmission(directory)).rejects.toThrow("Missing submission asset mapping");
  await writeFile(
    join(directory, "submission/assets.json"),
    JSON.stringify({ "../logo.png": "../pwa/public/pwa-64x64.png" }),
  );
  await expect(buildSubmission(directory)).rejects.toThrow(/Invalid key/);
});

it("validates configured PNG content and dimensions", async () => {
  const directory = await fixture();
  const path = join(directory, "../pwa/public/pwa-64x64.png");
  const original = await readFile(path);
  const wrongDimensions = Buffer.from(original);
  wrongDimensions.writeUInt32BE(32, 20);
  await writeFile(path, wrongDimensions);
  await expect(buildSubmission(directory)).rejects.toThrow("must be square");
  await writeFile(path, "not a PNG");
  await expect(buildSubmission(directory)).rejects.toThrow("Invalid PNG");
});

it("imports the configured demo URL without manufacturing one", async () => {
  const directory = await fixture();
  const config = structuredClone(metadata);
  const openai = config.extensions["com.openai"];

  const configured = {
    ...config,
    extensions: {
      "com.openai": {
        ...openai,
        review: { ...openai.review, demo_recording_url: "https://trizum.app/review/demo.mp4" },
      },
    },
  };

  await writeFile(join(directory, "submission/plugin.json"), JSON.stringify(configured));
  const result = await buildSubmission(directory);
  expect(result.needsDemoRecording).toBe(false);
  const files = unzipSync(await readFile(result.archivePath));
  expect(
    JSON.parse(strFromU8(files["plugin.json"])).extensions["com.openai"].review.demo_recording_url,
  ).toBe("https://trizum.app/review/demo.mp4");
});

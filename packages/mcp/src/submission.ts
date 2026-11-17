import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
import { z } from "zod";

const text = z.string().trim().min(1);

const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);

  return url.protocol === "https:" && !url.username && !url.password;
}, "Use an HTTPS URL without credentials.");

const imagePath = z.string().regex(/^\.\/assets\/[a-z0-9-]+\.png$/);

const reviewCase = z.strictObject({
  description: text.max(4000),
  prompt: text,
  tools_triggered: text.optional(),
  expected_behavior: text,
});

const manifestSchema = z.strictObject({
  $schema: z.literal("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"),
  name: z.literal("trizum"),
  description: text.max(4000),
  author: z.strictObject({ name: text.max(120), url: httpsUrl }),
  homepage: httpsUrl,
  repository: httpsUrl,
  license: text,
  keywords: z.array(text),
  extensions: z.strictObject({
    "com.openai": z.strictObject({
      interface: z.strictObject({
        displayName: z.literal("trizum"),
        shortDescription: text.max(30),
        longDescription: text.max(4000),
        developerName: text.max(80),
        category: text,
        capabilities: z.array(text.max(120)).max(20),
        websiteURL: httpsUrl,
        supportURL: httpsUrl,
        privacyPolicyURL: httpsUrl,
        termsOfServiceURL: httpsUrl,
        defaultPrompt: z.array(text.max(128)).min(1).max(3),
        logo: imagePath,
        composerIcon: imagePath,
        logoDark: imagePath.optional(),
        composerIconDark: imagePath.optional(),
      }),
      review: z.strictObject({
        commerce: z.literal(false),
        commerce_description: text,
        demo_recording_url: httpsUrl.optional(),
        test_cases: z.strictObject({
          positive: z.array(reviewCase.extend({ tools_triggered: text })).length(5),
          negative: z.array(reviewCase).length(3),
        }),
      }),
      publication: z.strictObject({
        countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
        translations: z.record(
          text,
          z.strictObject({ subtitle: text.max(30), description: text.max(4000) }),
        ),
      }),
    }),
  }),
});

const mcpSchema = z.strictObject({
  $schema: z.literal("https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"),
  mcpServers: z.strictObject({
    trizum: z.strictObject({
      type: z.literal("streamable-http"),
      url: httpsUrl,
      extensions: z.strictObject({
        "com.openai": z.strictObject({ auth: z.strictObject({ type: z.literal("none") }) }),
      }),
    }),
  }),
});

const assetsSchema = z.record(z.string().regex(/^assets\/[a-z0-9-]+\.png$/), text.endsWith(".png"));

async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await readFile(path, "utf8")));
}

function releaseNotes(changelog: string, version: string) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.indexOf(`## ${version}`);

  if (start === -1) throw new Error(`Missing MCP changelog entry for ${version}.`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));

  return text.parse(lines.slice(start + 1, next === -1 ? undefined : next).join("\n"));
}

function validateIcon(data: Buffer, path: string) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (
    data.length < 24 ||
    data.length > 5 * 1024 * 1024 ||
    !data.subarray(0, 8).equals(pngSignature) ||
    data.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error(`Invalid PNG submission asset: ${path}.`);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);

  if (width !== height || width < 48 || width > 4096)
    throw new Error(`Submission asset must be square and 48–4096 pixels: ${path}.`);
}

/** Build only public submission metadata and explicitly selected image assets. */
export async function buildSubmission(packageDirectory: string, releaseTag?: string) {
  const pkg = await readJson(
    join(packageDirectory, "package.json"),
    z.object({
      name: z.literal("@trizum/mcp"),
      version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
    }),
  );

  if (releaseTag !== undefined && releaseTag !== `${pkg.name}@${pkg.version}`)
    throw new Error(`Release tag ${releaseTag} does not match ${pkg.name}@${pkg.version}.`);

  const source = join(packageDirectory, "submission");
  const metadata = await readJson(join(source, "plugin.json"), manifestSchema);
  const mcp = await readJson(join(source, "mcp.json"), mcpSchema);
  const assets = await readJson(join(source, "assets.json"), assetsSchema);
  const changelog = await readFile(join(packageDirectory, "CHANGELOG.md"), "utf8");
  const openai = metadata.extensions["com.openai"];

  const manifest = {
    ...metadata,
    version: pkg.version,
    extensions: {
      "com.openai": {
        ...openai,
        publication: { ...openai.publication, release_notes: releaseNotes(changelog, pkg.version) },
      },
    },
  };

  for (const reference of [
    openai.interface.logo,
    openai.interface.composerIcon,
    openai.interface.logoDark,
    openai.interface.composerIconDark,
  ]) {
    if (reference !== undefined && !Object.hasOwn(assets, reference.slice(2)))
      throw new Error(`Missing submission asset mapping for ${reference}.`);
  }

  const images = await Promise.all(
    Object.entries(assets)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(async ([destination, sourcePath]) => {
        const data = await readFile(join(packageDirectory, sourcePath));
        validateIcon(data, sourcePath);

        return [destination, data] as const;
      }),
  );

  const files = Object.fromEntries(images);
  files["plugin.json"] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  files["mcp.json"] = Buffer.from(`${JSON.stringify(mcp, null, 2)}\n`);

  // A fixed local DOS timestamp makes the ZIP reproducible across machines and time zones.
  const archive = zipSync(files, { level: 9, mtime: new Date(1980, 0, 1) });
  const directory = join(packageDirectory, "artifacts");
  const filename = `trizum-chatgpt-${pkg.version}.zip`;
  const archivePath = join(directory, filename);
  const checksumPath = `${archivePath}.sha256`;
  const digest = createHash("sha256").update(archive).digest("hex");
  await mkdir(directory, { recursive: true });
  await writeFile(archivePath, archive);
  await writeFile(checksumPath, `${digest}  ${filename}\n`);

  return { archivePath, checksumPath, needsDemoRecording: !openai.review.demo_recording_url };
}

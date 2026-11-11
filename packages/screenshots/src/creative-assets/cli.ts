import { configureScreenshotsLogging, getLogger } from "../log.ts";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  CREATIVE_OUTPUT,
  generateHeader,
  generateHeaderPreview,
  generateSearch,
} from "./render.ts";
import { prepareCreativeAssets, validateCreativeManifest } from "./manifest.ts";

configureScreenshotsLogging();

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", default: CREATIVE_OUTPUT },
    from: { type: "string" },
    kind: { type: "string" },
    media: { type: "string" },
    "poster-time-code": { type: "string" },
  },
});

const command = positionals[0];
const output = path.resolve(values.output);

if (command === "preview") {
  await generateHeader(output, false);
  await generateHeaderPreview(output);
} else if (command === "header") {
  await generateHeader(output);
  await generateHeaderPreview(output);
} else if (command === "search") {
  await generateSearch(output);
} else if (command === "prepare") {
  const kind = values.kind;

  if ((kind !== "header" && kind !== "search") || !values.from)
    throw new Error("Use --kind header|search --from <reviewed-output-directory>");
  const media = values.media || (kind === "header" ? "video" : "image");

  if (media !== "video" && media !== "image") throw new Error("Use --media image|video");
  await prepareCreativeAssets(kind, values.from, media, values["poster-time-code"]);
  await validateCreativeManifest();
} else if (command === "validate") {
  await validateCreativeManifest();
} else {
  throw new Error("Choose preview, header, search, prepare, or validate");
}

getLogger("creativeAssets").info(
  command === "prepare" || command === "validate"
    ? "Selected release assets validated; no upload performed."
    : `Generated review drafts in ${output}`,
);

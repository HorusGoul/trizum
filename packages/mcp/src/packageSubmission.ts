import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildSubmission } from "./submission.js";

const result = await buildSubmission(
  fileURLToPath(new URL("../", import.meta.url)),
  process.env.RELEASE_TAG,
);

process.stdout.write(`Created ${result.archivePath}\nChecksum: ${result.checksumPath}\n`);

if (result.needsDemoRecording)
  process.stdout.write(
    "Add review.demo_recording_url to submission/plugin.json before submitting for review.\n",
  );

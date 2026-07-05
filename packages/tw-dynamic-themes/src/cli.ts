#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateCssVariables } from "./css.js";

const colorName = process.argv[2];
const hue = process.argv[3];
const outputPath = process.argv[4];

if (!colorName || !hue || !outputPath) {
  process.stderr.write("Usage: twdt <colorName> <hue> <outputPath>\n");
  process.exit(1);
}

// Create CSS content
const cssContent = generateCssVariables(colorName, Number.parseInt(hue, 10));

// Write to file
try {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, cssContent, "utf-8");
  process.stdout.write(`CSS file generated successfully at ${outputPath}\n`);
} catch (error) {
  process.stderr.write(`Error writing CSS file: ${String(error)}\n`);
  process.exit(1);
}

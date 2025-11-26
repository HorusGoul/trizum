import { loadEnvFile } from "node:process";
import * as path from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

const envFile = path.resolve(__dirname, ".env");

try {
  loadEnvFile(envFile);
} catch {
  console.log("No .env file found, using defaults.");
}

const DEV_MODE = process.env.DEV_MODE === "true";
const DEV_URL = process.env.DEV_URL;

let serverConfig: CapacitorConfig["server"] = undefined;

if (DEV_MODE) {
  if (!DEV_URL) {
    console.error(
      "Ensure DEV_URL is set in the .env file when you are trying to develop the app.",
    );
    console.error("Example: DEV_URL=http://192.168.1.101:5173");
    // process.exit(1);
  } else {
    serverConfig = {
      url: DEV_URL,
      cleartext: true,
    };
  }
}

const config: CapacitorConfig = {
  appId: "app.trizum.capacitor",
  appName: "trizum",
  webDir: "dist",
  server: serverConfig,
};

export default config;

import { loadEnvFile } from "node:process";
import * as path from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";
import { configureMobileLogging, getLogger } from "./src/log.js";

configureMobileLogging();

const logger = getLogger("capacitorConfig");

const envFile = path.resolve(__dirname, ".env");

try {
  loadEnvFile(envFile);
} catch {
  logger.info("No .env file found, using defaults.");
}

const DEV_MODE = process.env.DEV_MODE === "true";
const DEV_URL = process.env.DEV_URL;

let serverConfig: CapacitorConfig["server"] = undefined;

if (DEV_MODE) {
  if (!DEV_URL) {
    logger.error(
      "Ensure DEV_URL is set in the .env file when you are trying to develop the app.",
    );
    logger.error("Example: DEV_URL=http://192.168.1.101:5173");
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
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;

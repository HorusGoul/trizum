import * as path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { configureTrizumLogging, getTrizumLogger } from "@trizum/logging";

configureTrizumLogging({ surface: "mobile" });

const logger = getTrizumLogger("mobile", "capacitorConfig");
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(currentDirectory, ".env");

try {
  loadEnvFile(envFile);
} catch {
  logger.info("No .env file found, using defaults.");
}

const DEV_MODE = process.env.DEV_MODE === "true";
const DEV_URL = process.env.DEV_URL;

let serverConfig = undefined;

if (DEV_MODE) {
  if (!DEV_URL) {
    logger.error("Ensure DEV_URL is set in the .env file when you are trying to develop the app.");
    logger.error("Example: DEV_URL=http://192.168.1.101:5173");
  } else {
    serverConfig = {
      cleartext: true,
      url: DEV_URL,
    };
  }
}

const config = {
  appId: "app.trizum.capacitor",
  appName: "trizum",
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
  server: serverConfig,
  webDir: "dist",
};

export const { appId, appName, ios, plugins, server, webDir } = config;

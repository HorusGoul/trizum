import { loadEnvFile } from "node:process";
import * as path from "node:path";
import { z } from "zod";
import { rootLogger } from "./log.ts";

const packageRoot = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(packageRoot, ".env");

try {
  loadEnvFile(envFile);
} catch {
  if (process.env.NODE_ENV !== "production") {
    rootLogger.error(
      "Failed to load .env file, please copy the .env.tpl to .env and fill in the values.",
    );
    process.exit(1);
  }
}

const envSchema = z.object({
  DB_FILE_NAME: z.string(),
  PORT: z
    .string()
    .default("3000")
    .refine((port) => {
      const num = parseInt(port);
      return !isNaN(num) && num > 0 && num < 65536;
    }, "PORT must be a valid port number"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  COMMIT_HASH: z.string().optional(),
});

type TypedEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- We need to extend the ProcessEnv type
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- We need to extend the ProcessEnv type
    interface ProcessEnv extends TypedEnv {}
  }
}

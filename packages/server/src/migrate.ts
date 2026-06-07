import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./db.ts";
import { configureServerLogging, rootLogger as logger } from "./log.ts";
import { fileURLToPath } from "node:url";

configureServerLogging();

export async function runMigrations() {
  const migrationsFolder =
    process.env.DRIZZLE_MIGRATIONS_FOLDER ?? path.resolve(process.cwd(), "drizzle");

  logger.info("Applying database migrations", { migrationsFolder });
  await migrate(db, { migrationsFolder });
  logger.info("Database migrations applied");
}

function isSourceEntrypoint() {
  if (!process.argv[1]) {
    return false;
  }

  const modulePath = fileURLToPath(import.meta.url);
  return (
    modulePath.endsWith(`${path.sep}src${path.sep}migrate.ts`) &&
    path.resolve(process.argv[1]) === modulePath
  );
}

if (isSourceEntrypoint()) {
  runMigrations().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getApiDb(db: D1Database) {
  return drizzle(db, { schema });
}

export { schema };

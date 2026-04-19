import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __db?: Database; __pool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString: url });
}

const pool = globalForDb.__pool ?? createPool();
const dbInstance: Database = globalForDb.__db ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pool = pool;
  globalForDb.__db = dbInstance;
}

export const db = dbInstance;
export { schema };

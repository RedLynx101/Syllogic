import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Point it at a PostgreSQL database, e.g. postgresql://user:pass@localhost:5432/syllogic",
  );
}

// One connection pool shared by Drizzle (app data) and connect-pg-simple (sessions).
export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool);

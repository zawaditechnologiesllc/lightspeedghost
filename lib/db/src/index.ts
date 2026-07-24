import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool tuned for sustained traffic (target: 2,000+ users/hour). `max` is
// overridable via DB_POOL_MAX so it can be matched to the Supabase tier /
// pooler mode (transaction pooler on :6543 multiplexes, so 20 client
// connections serve far more concurrent requests). Timeouts recycle stuck
// connections instead of leaking them under load. Point DATABASE_URL at the
// Supabase connection pooler for best throughput.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A pool-level 'error' on an idle client would otherwise crash the process —
// log and let the pool evict it so the API stays up under load.
pool.on("error", (err) => {
  console.error("[db] unexpected idle client error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";

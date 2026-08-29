/**
 * The database handle.
 *
 * Uses the pooled Neon driver rather than the HTTP one because applying a
 * rubric to a project writes a rubric application, one assessment per
 * criterion, and a board's worth of cards. That has to be one transaction or
 * a project can end up half-scored, and the HTTP driver cannot do transactions.
 *
 * Node 22+ supplies a global WebSocket, which is why there is no `ws` shim here.
 */

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString: string) {
  return drizzle(new Pool({ connectionString }), { schema, casing: "snake_case" });
}

let cached: Database | undefined;

/**
 * The process-wide handle, built from `DATABASE_URL` on first use.
 *
 * Throws rather than returning a broken client: a missing connection string is
 * a misconfigured deploy, and it should fail at the first query with a message
 * that says so, not several frames later inside the driver.
 */
export function db(): Database {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Neon branch.",
      );
    }
    cached = createDatabase(url);
  }
  return cached;
}

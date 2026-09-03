/**
 * The database handle.
 *
 * `@netlify/database` reads `NETLIFY_DB_URL` (which Netlify injects for a project with a
 * database attached) and hands back a `waddler` tagged-template `sql`. Every query in this
 * codebase goes through that template, so values are always sent as bound parameters and never
 * concatenated into SQL.
 *
 * The connection is created lazily and cached on the module, because a warm function instance
 * handles many requests and reconnecting per invocation would be wasteful.
 */

import { getDatabase, type DatabaseConnection } from '@netlify/database';

let cached: DatabaseConnection | null = null;

export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('database_unavailable');
    this.name = 'DatabaseUnavailableError';
    this.cause = cause;
  }
}

/** True when a connection string is configured. Used to fail loudly at the edge, not mid-write. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.NETLIFY_DB_URL ?? process.env.NETLIFY_DATABASE_URL);
}

export function db(): DatabaseConnection {
  if (cached) return cached;

  try {
    cached = getDatabase();
    return cached;
  } catch (error) {
    // Never surfaced to a caller — the handlers turn this into a generic 503 so a
    // misconfiguration cannot leak a host name or a credential through an error body.
    throw new DatabaseUnavailableError(error);
  }
}

/**
 * Run a set of statements inside one transaction on a single pooled connection.
 *
 * Completing an attempt writes an `attempts` row and conditionally updates the player's
 * personal best; those two must not be able to half-happen.
 */
export async function withTransaction<T>(
  run: (sql: DatabaseConnection['sql']) => Promise<T>,
): Promise<T> {
  const connection = db();
  const { sql } = connection;

  await sql`BEGIN`;
  try {
    const result = await run(sql);
    await sql`COMMIT`;
    return result;
  } catch (error) {
    try {
      await sql`ROLLBACK`;
    } catch {
      // A rollback that itself fails means the connection is gone; the original error is the
      // one worth reporting, so it is deliberately not replaced here.
    }
    throw error;
  }
}

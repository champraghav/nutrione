import { Pool } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle Postgres client');
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const result = await pool.query(text, params);
  logger.debug({ text, duration: Date.now() - start, rows: result.rowCount }, 'query executed');
  return result.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a single transaction, rolling back if it throws.
 *
 * The callback is handed scoped `query`/`queryOne` bound to the same client —
 * using the pool-level helpers inside would run on a different connection and
 * silently escape the transaction.
 */
export async function transaction<T>(
  fn: (tx: {
    query: <R = any>(text: string, params?: any[]) => Promise<R[]>;
    queryOne: <R = any>(text: string, params?: any[]) => Promise<R | null>;
  }) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scopedQuery = async <R = any>(text: string, params?: any[]): Promise<R[]> =>
      (await client.query(text, params)).rows;
    const result = await fn({
      query: scopedQuery,
      queryOne: async <R = any>(text: string, params?: any[]) => (await scopedQuery<R>(text, params))[0] ?? null,
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

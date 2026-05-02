import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// Generic: query<BookingLinkRow>('SELECT ...') types result.rows when you need it.
// Default stays 'any' for backward-compat — existing callers don't break.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = <T extends Record<string, any> = any>(text: string, params?: any[]) => pool.query<T>(text, params);

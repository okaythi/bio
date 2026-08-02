import type { D1Database } from '../../lib/db';

export interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
    headers: { "Content-Type": "application/json" }
  });
};

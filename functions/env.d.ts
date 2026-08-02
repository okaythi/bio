import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export {};

declare global {
  interface Env {
    DB: D1Database;
    movies?: R2Bucket;
    TELEMETRY_BLOBS?: R2Bucket;
    TELEMETRY_ANALYTICS?: { writeDataPoint(data: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void };
    TELEMETRY_QUEUE?: { send(message: unknown): Promise<void> };
    AI?: { run(model: string, input: { messages: { role: string; content: string }[] }): Promise<any> };
    VPN_API_KEY?: string;
    ADMIN_SECRET?: string;
    TURNSTILE_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    JWT_SECRET?: string;
    VITE_TMDB_API_TOKEN?: string;
  }

  type AppEventContext<
    E = Env,
    P extends string = string,
    D extends Record<string, unknown> = Record<string, unknown>
  > = EventContext<E, P, D>;
}

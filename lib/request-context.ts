/**
 * Request-scoped context — propagates a request ID through the
 * server action pipeline so every log line can be correlated to
 * a single user request.
 *
 * Uses AsyncLocalStorage (Node 18.6+) for zero-overhead propagation.
 * Falls back gracefully in edge runtimes or environments without ALS.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function within a request context. All `getRequestContext()`
 * calls inside will return the same context.
 */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/** Get the current request context (or undefined if outside a context). */
export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

/** Generate a compact request ID (12 hex chars, collision-resistant). */
export function generateRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

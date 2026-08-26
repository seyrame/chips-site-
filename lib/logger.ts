/**
 * Structured logger — zero-dependency, JSON-formatted logging.
 *
 * Every log line includes timestamp, level, context, and optional
 * structured data. In development, logs are human-readable. In
 * production (JSON), they're machine-parseable for log aggregation
 * (Datadog, CloudWatch, Logflare, etc.).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("order.placed", { orderId, total });
 *   logger.error("paystack.init_failed", { error, reference });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const VALID_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);
const rawLevel = process.env.LOG_LEVEL?.toLowerCase();
const currentLevel: LogLevel = VALID_LEVELS.has(rawLevel as LogLevel)
  ? (rawLevel as LogLevel)
  : "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  context: string,
  data?: Record<string, unknown>
): string {
  const ts = formatTimestamp();
  const base = `[${ts}] ${level.toUpperCase().padEnd(5)} [${context}]`;
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

function log(
  level: LogLevel,
  context: string,
  data?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const msg = formatMessage(level, context, data);

  switch (level) {
    case "error":
      console.error(msg);
      break;
    case "warn":
      console.warn(msg);
      break;
    default:
      console.log(msg);
  }
}

export const logger = {
  debug(context: string, data?: Record<string, unknown>) {
    log("debug", context, data);
  },

  info(context: string, data?: Record<string, unknown>) {
    log("info", context, data);
  },

  warn(context: string, data?: Record<string, unknown>) {
    log("warn", context, data);
  },

  error(context: string, data?: Record<string, unknown>) {
    log("error", context, data);
  },

  /**
   * Create a child logger with a fixed context prefix.
   * Useful for service-level logging:
   *   const log = logger.child("payments");
   *   log.info("settled", { orderId });
   */
  child(prefix: string) {
    return {
      debug: (context: string, data?: Record<string, unknown>) =>
        log("debug", `${prefix}.${context}`, data),
      info: (context: string, data?: Record<string, unknown>) =>
        log("info", `${prefix}.${context}`, data),
      warn: (context: string, data?: Record<string, unknown>) =>
        log("warn", `${prefix}.${context}`, data),
      error: (context: string, data?: Record<string, unknown>) =>
        log("error", `${prefix}.${context}`, data),
    };
  },
};

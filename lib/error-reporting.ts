/**
 * Error reporting — captures structured error data for external
 * monitoring services. Zero-dependency; integrates with any provider
 * by implementing the ErrorReporter interface.
 *
 * Currently logs to structured logger. Swap in Sentry, Bugsnag,
 * Datadog RUM, etc. by providing a custom reporter.
 */

import { logger } from "@/lib/logger";
import { getRequestContext } from "@/lib/request-context";

export interface ErrorReport {
  /** Unique error fingerprint (e.g. "paystack/init_failed"). */
  fingerprint: string;
  /** Human-readable message. */
  message: string;
  /** Severity level. */
  level: "warning" | "error" | "fatal";
  /** The original error object. */
  cause?: unknown;
  /** Additional context. */
  tags?: Record<string, string>;
  /** Request context (auto-populated if available). */
  requestId?: string;
}

export interface ErrorReporter {
  capture(report: ErrorReport): void;
}

/** Default reporter — logs to structured logger. */
const consoleReporter: ErrorReporter = {
  capture(report: ErrorReport) {
    const ctx = getRequestContext();
    const data: Record<string, unknown> = {
      fingerprint: report.fingerprint,
      message: report.message,
      requestId: report.requestId ?? ctx?.requestId,
      ...report.tags,
    };

    if (report.cause instanceof Error) {
      data.errorName = report.cause.name;
      data.errorMessage = report.cause.message;
      data.stack = report.cause.stack;
    }

    logger.error(report.fingerprint, data);
  },
};

let activeReporter: ErrorReporter = consoleReporter;

/**
 * Set a custom error reporter (e.g. Sentry, Bugsnag).
 * Call once at app startup.
 */
export function setErrorReporter(reporter: ErrorReporter): void {
  activeReporter = reporter;
}

/**
 * Capture an error report. Use this instead of console.error for
 * errors that should be tracked and monitored.
 */
export function captureError(report: ErrorReport): void {
  try {
    activeReporter.capture(report);
  } catch {
    // Never let error reporting crash the app.
    console.error("[error-reporter] capture failed", report.fingerprint);
  }
}

/**
 * Convenience wrapper for try/catch blocks.
 * Captures the error and returns a user-friendly fallback.
 */
export function withErrorCapture<T>(
  fingerprint: string,
  fn: () => T,
  fallback: T,
  tags?: Record<string, string>
): T {
  try {
    return fn();
  } catch (cause) {
    captureError({
      fingerprint,
      message: cause instanceof Error ? cause.message : String(cause),
      level: "error",
      cause,
      tags,
    });
    return fallback;
  }
}

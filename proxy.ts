import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import {
  checkRateLimit,
  rateLimitKey,
  LOGIN_LIMIT,
  API_READ_LIMIT,
} from "@/lib/rate-limit";
import { generateRequestId } from "@/lib/request-context";
import { logger } from "@/lib/logger";

/**
 * TT Brothers edge gate — Next.js 16's replacement for middleware.
 *
 * Responsibilities:
 *  1. Generate a unique request ID for every incoming request.
 *  2. Rate-limit sensitive routes (login, API reads).
 *  3. Refresh Supabase auth cookies on every navigation.
 *  4. Cheap redirect for /admin/* requests without session cookies.
 */

const ADMIN_PREFIX = "/admin";
const LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestId = generateRequestId();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const responseHeaders = new Headers({ "X-Request-Id": requestId });

  logger.debug("request.received", {
    requestId,
    method: request.method,
    pathname,
    ip,
  });

  // ── Rate limiting for login page ──
  if (pathname === LOGIN_PATH && request.method === "GET") {
    const rl = checkRateLimit(rateLimitKey(ip, "login"), LOGIN_LIMIT);
    if (!rl.allowed) {
      logger.warn("rate_limit.login", { requestId, ip });
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          ...Object.fromEntries(responseHeaders),
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-Request-Id": requestId,
        },
      });
    }
  }

  // ── Rate limiting for API read routes ──
  if (pathname.startsWith("/api/") && request.method === "GET") {
    const rl = checkRateLimit(rateLimitKey(ip, "api-read"), API_READ_LIMIT);
    if (!rl.allowed) {
      logger.warn("rate_limit.api", { requestId, ip, pathname });
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-Request-Id": requestId,
        },
      });
    }
  }

  const isAdminArea =
    pathname === ADMIN_PREFIX ||
    (pathname.startsWith(ADMIN_PREFIX + "/") && pathname !== LOGIN_PATH);

  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  // No cookie + protected area → straight to login, no network call.
  if (isAdminArea && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Anonymous storefront requests skip session refresh entirely.
  if (!hasSessionCookie) {
    const res = NextResponse.next({ request });
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  // Refresh the session (rotates tokens when near expiry).
  let response = NextResponse.next({ request });

  try {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
      getPublicEnv();

    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Stale/invalid cookie + protected area → login with expiry notice.
    if (!user && isAdminArea) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      url.searchParams.set("reason", "expired");
      return NextResponse.redirect(url);
    }
  } catch (e) {
    logger.error("proxy.session_refresh_failed", {
      requestId,
      pathname,
      error: e instanceof Error ? e.message : String(e),
    });
    // Env misconfiguration or network hiccup: never block the storefront.
    if (isAdminArea) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = "";
      url.searchParams.set("reason", "error");
      return NextResponse.redirect(url);
    }
  }

  // Attach request ID to all responses.
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimizer output, the
     * health endpoint and the Paystack webhook (which authenticates via
     * HMAC signature and must not pay an auth round-trip per event).
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|api/health|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

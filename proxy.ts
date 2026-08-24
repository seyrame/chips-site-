import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

/**
 * TT Brothers edge gate — Next.js 16's replacement for middleware.
 *
 * Responsibilities (deliberately thin):
 *  1. Refresh Supabase auth cookies on every navigation so server
 *     components always see a valid session.
 *  2. Cheap redirect for /admin/* requests that carry no session
 *     cookie at all — avoids a wasted network round-trip. The REAL
 *     authorization (role lookup) happens in the (panel) layout,
 *     which cannot be bypassed by crafted requests.
 */

const ADMIN_PREFIX = "/admin";
const LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea =
    pathname === ADMIN_PREFIX ||
    (pathname.startsWith(ADMIN_PREFIX) && pathname !== LOGIN_PATH);

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
  } catch {
    // Env misconfiguration or network hiccup: never block the storefront.
    // Protected areas re-verify in the (panel) layout regardless.
    if (isAdminArea) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = "";
      url.searchParams.set("reason", "error");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimizer output, the
     * health endpoint and the Paystack webhook (which authenticates via
     * HMAC signature and must not pay an auth round-trip per event).
     */
    "/((?!_next/static|_next/image|favicon.ico|images|api/health|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

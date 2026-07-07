import { NextResponse, type NextRequest } from "next/server";

/**
 * Page-level auth redirects (UX only — real enforcement lives in the API
 * routes and server components via requireAuth/getAuth, which validate the
 * session against the database).
 *
 * When no DATABASE_URL is configured the app runs in keyless demo mode and
 * stays open.
 */

const PROTECTED = [/^\/dashboard/, /^\/new/, /^\/deck\//, /^\/brand/];
const AUTH_PAGES = [/^\/login$/, /^\/signup$/];

export function proxy(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get("ds_session")?.value);

  if (!hasSessionCookie && PROTECTED.some((re) => re.test(pathname))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (hasSessionCookie && AUTH_PAGES.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

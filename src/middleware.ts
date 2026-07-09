import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-core";

const PUBLIC_PATHS = ["/login", "/api/auth", "/entry", "/api/entry", "/results", "/api/images", "/favicon.ico", "/unsubscribe", "/api/unsubscribe", "/api/diag", "/api/ping"];

// Public form paths: /f/<slug> (form page) and /api/forms/<slug>/submit (submission),
// distinct from the admin /forms and /api/forms routes which stay protected.
const PUBLIC_FORM_PATH = /^\/f(\/|$)/;
const FORM_SUBMIT_PATH = /^\/api\/forms\/[^/]+\/submit$/;
const FORM_UPLOAD_PATH = /^\/api\/forms\/upload$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    PUBLIC_FORM_PATH.test(pathname) ||
    FORM_SUBMIT_PATH.test(pathname) ||
    FORM_UPLOAD_PATH.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check auth token
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-core";
import {
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE,
  PREVIEW_PATHS,
  PREVIEW_REALM,
  checkBasicAuth,
  createPreviewToken,
  previewEnabled,
  verifyPreviewToken,
} from "@/lib/preview-auth";
import {
  PUBLIC_PATHS,
  PUBLIC_FORM_PATH,
  FORM_SUBMIT_PATH,
  FORM_UPLOAD_PATH,
  matchesPathPrefix,
} from "@/lib/public-paths";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Propagate the current pathname to Server Components via a request
  // header, since Next.js has no built-in API to read it there (e.g.
  // RootLayout uses this to decide whether to render the admin sidebar).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Allow public paths
  if (
    PUBLIC_PATHS.some((p) => matchesPathPrefix(pathname, p)) ||
    PUBLIC_FORM_PATH.test(pathname) ||
    FORM_SUBMIT_PATH.test(pathname) ||
    FORM_UPLOAD_PATH.test(pathname)
  ) {
    return next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon")
  ) {
    return next();
  }

  // 公開前の確認用アクセス。PREVIEW_USER / PREVIEW_PASSWORD を設定しているあいだだけ、
  // /web（公開サイト）とそのファイル配信を ID・パスワードで開ける。管理画面はこの下の
  // 通常のログイン確認に進むので、この仕組みからは入れない。
  if (previewEnabled() && PREVIEW_PATHS.some((p) => matchesPathPrefix(pathname, p))) {
    const staff = request.cookies.get("auth_token")?.value;
    if (staff && (await verifyToken(staff))) {
      return next();
    }
    if (await verifyPreviewToken(request.cookies.get(PREVIEW_COOKIE)?.value)) {
      return next();
    }
    if (checkBasicAuth(request.headers.get("authorization"))) {
      const res = next();
      res.cookies.set(PREVIEW_COOKIE, await createPreviewToken(), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: PREVIEW_MAX_AGE,
      });
      return res;
    }
    return new NextResponse("認証が必要です", {
      status: 401,
      headers: { "WWW-Authenticate": `Basic realm="${PREVIEW_REALM}", charset="UTF-8"` },
    });
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

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

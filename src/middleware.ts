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
  ADMIN_ORIGIN,
  PUBLIC_SITE_ORIGIN,
  PUBLIC_SITE_HOST,
  hostOf,
  isAdminPage,
  isPublicSiteHost,
  legacyRedirect,
  publicSiteRewrite,
} from "@/lib/site-host";
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
  const search = request.nextUrl.search;

  // ---- 公開サイトのドメイン（gotouchireisyoku.com） ----
  const host = hostOf(request.headers.get("host"));
  if (isPublicSiteHost(host)) {
    // www なしにそろえる
    if (host !== PUBLIC_SITE_HOST) {
      return NextResponse.redirect(`${PUBLIC_SITE_ORIGIN}${pathname}${search}`, 308);
    }
    // 旧サイト（WordPress）のURL
    const legacy = legacyRedirect(pathname);
    if (legacy) {
      return NextResponse.redirect(new URL(legacy, request.url), legacy === "/leaflet" ? 302 : 301);
    }
    // プレビュー用の /web/... で来たら、きれいなURLへ
    if (matchesPathPrefix(pathname, "/web")) {
      return NextResponse.redirect(new URL(pathname.slice(4) || "/", request.url), 308);
    }
    // 公開サイトのページは、ログインなしで src/app/web のページを出す
    const target = publicSiteRewrite(pathname);
    if (target) {
      requestHeaders.set("x-pathname", target);
      return NextResponse.rewrite(new URL(`${target}${search}`, request.url), { request: { headers: requestHeaders } });
    }
    // 管理画面のページ（ログイン画面を含む）に来たら、管理用のドメインへ
    if (isAdminPage(pathname)) {
      return NextResponse.redirect(`${ADMIN_ORIGIN}${pathname}${search}`, 307);
    }
    // それ以外で公開サイトに無いURLは、公開サイトの「ページが見つかりません」を出す
    // （API と公開物＝エントリー・フォーム・画像などは下の共通処理に任せる）
    const publicish =
      PUBLIC_PATHS.some((p) => matchesPathPrefix(pathname, p)) ||
      PUBLIC_FORM_PATH.test(pathname) ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon");
    if (!publicish && !pathname.startsWith("/api/")) {
      requestHeaders.set("x-pathname", "/web/not-found");
      return NextResponse.rewrite(new URL("/web/not-found", request.url), { request: { headers: requestHeaders } });
    }
  }

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
  // 公開後（PREVIEW_USER を外したあと）は、管理用ドメインの /web は公開ドメインへ送る（同じページを二重に出さない）
  if (!previewEnabled() && matchesPathPrefix(pathname, "/web")) {
    return NextResponse.redirect(`${PUBLIC_SITE_ORIGIN}${pathname.slice(4) || "/"}${search}`, 308);
  }
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

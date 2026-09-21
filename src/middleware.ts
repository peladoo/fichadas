import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_MUNICIPIO_SLUG || "san-benito";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/m/${DEFAULT_SLUG}`, request.url));
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const suffix = pathname.slice("/admin".length);
    return NextResponse.redirect(
      new URL(`/m/${DEFAULT_SLUG}/admin${suffix}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};

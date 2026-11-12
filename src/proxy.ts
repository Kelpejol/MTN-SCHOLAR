import { NextResponse, type NextRequest } from "next/server";
import { COOKIES, verifyToken, type AdminToken, type VoterToken } from "@/lib/tokens";

/**
 * Fast, optimistic route guard (cookie signature only). Pages and actions re-check the
 * session against the database, so this is a UX layer — not the only line of defence.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const admin = await verifyToken<AdminToken>(request.cookies.get(COOKIES.admin)?.value, "admin");
    const isLogin = pathname === "/admin/login";
    if (!admin && !isLogin) {
      const url = new URL("/admin/login", request.url);
      if (pathname !== "/admin") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    if (admin && isLogin) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/vote")) {
    const voter = await verifyToken<VoterToken>(request.cookies.get(COOKIES.voter)?.value, "voter");
    if (!voter) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/vote/:path*"],
};

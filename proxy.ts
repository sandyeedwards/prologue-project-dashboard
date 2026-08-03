import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./src/lib/auth/constants";

const protectedPrefixes = ["/dashboard", "/projects", "/compare", "/manager", "/admin"];

export default function proxy(request: NextRequest) {
  const protectedRoute = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  if (protectedRoute && !request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/compare/:path*",
    "/manager/:path*",
    "/admin/:path*",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";

const HOME_PATH = "/";
const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/signup";
const AUTH_PAGES = [LOGIN_PATH, SIGNUP_PATH];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasToken = !!request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (hasToken && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }
  if (!hasToken && pathname === HOME_PATH) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|bmp|avif|ttf|otf|woff|woff2|eot)).*)"],
};

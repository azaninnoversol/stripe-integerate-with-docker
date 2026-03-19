/**
 * Auth cookie name and options. Token is stored in HTTP-only cookie.
 */
export const AUTH_COOKIE_NAME = "auth_token";

const COOKIE_MAX_AGE_DAYS = 7;
export const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

export function buildSetCookieHeader(token: string, maxAgeSeconds: number = COOKIE_MAX_AGE_SECONDS): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

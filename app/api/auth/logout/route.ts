import { NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth-cookie";

export const runtime = "nodejs";

export async function POST() {
  const nextRes = NextResponse.json({ ok: true });
  nextRes.headers.set("Set-Cookie", buildClearCookieHeader());
  return nextRes;
}

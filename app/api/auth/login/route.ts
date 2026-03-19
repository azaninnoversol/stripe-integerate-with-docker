import { NextResponse } from "next/server";
import { buildSetCookieHeader } from "@/lib/auth-cookie";

export const runtime = "nodejs";

// Helper for proxying to Firebase Auth REST API (needs Web API Key from Firebase Console)
async function firebaseAuthProxy(url: string, payload: object) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing Firebase API key (set FIREBASE_WEB_API_KEY or NEXT_PUBLIC_FIREBASE_API_KEY)" }), {
      status: 500,
    });
  }

  const finalUrl = url.includes("?") ? `${url}&key=${apiKey}` : `${url}?key=${apiKey}`;

  return fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const FIREBASE_AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  const url = `${FIREBASE_AUTH_BASE}/accounts:signInWithPassword`;
  const res = await firebaseAuthProxy(url, {
    email,
    password,
    returnSecureToken: true,
  });

  if (!res.ok) {
    let data: { error?: string | { message?: string }; message?: string } = {};
    try {
      data = await res.json();
    } catch {}
    const rawMessage =
      typeof data?.error === "string"
        ? data.error
        : data?.error && typeof data.error === "object" && "message" in data.error
          ? (data.error as { message?: string }).message
          : data?.message;
    const message =
      rawMessage === "INVALID_PASSWORD" ? "Invalid password" : rawMessage === "EMAIL_NOT_FOUND" ? "User not found" : (rawMessage ?? "Login failed");
    const status = res.status;
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 401 });
  }

  const data = await res.json();
  const idToken = data.idToken as string | undefined;
  if (!idToken) {
    return NextResponse.json({ error: "No token in response" }, { status: 500 });
  }
  const nextRes = NextResponse.json({
    ok: true,
    localId: data.localId,
    email: data.email,
    displayName: data.displayName ?? null,
  });
  nextRes.headers.set("Set-Cookie", buildSetCookieHeader(idToken));
  return nextRes;
}

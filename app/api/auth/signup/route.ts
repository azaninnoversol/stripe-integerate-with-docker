import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore, USERS_COLLECTION } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, displayName } = body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  const trimmedEmail = (email ?? "").trim().toLowerCase();
  if (!trimmedEmail) return NextResponse.json({ error: "Missing email" }, { status: 400 });
  if (!password || typeof password !== "string") return NextResponse.json({ error: "Missing password" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  try {
    const auth = getAdminAuth();
    const userRecord = await auth.createUser({
      email: trimmedEmail,
      password,
      displayName: (displayName ?? "").trim() || undefined,
      emailVerified: false,
    });

    const uid = userRecord.uid;
    const db = getAdminFirestore();
    const now = Date.now();
    await db.collection(USERS_COLLECTION).doc(uid).set(
      {
        email: trimmedEmail,
        displayName: (displayName ?? "").trim() || null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      uid,
      email: userRecord.email,
      displayName: userRecord.displayName ?? null,
    });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "auth/email-already-exists" || code === "auth/invalid-email") {
      return NextResponse.json({ error: code === "auth/email-already-exists" ? "Email already in use" : "Invalid email" }, { status: 400 });
    }
    console.error("POST /api/auth/signup error:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

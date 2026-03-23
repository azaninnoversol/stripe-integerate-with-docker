import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminFirestore, USERS_COLLECTION } from "@/lib/firebase-admin";
import { AUTH_COOKIE_NAME, buildClearCookieHeader } from "@/lib/auth-cookie";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const tokenFromCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = req.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = tokenFromCookie ?? tokenFromHeader;
  if (!token) return NextResponse.json({ error: "Missing auth (cookie or Authorization header)" }, { status: 401 });

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminFirestore();
    const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : null;

    return NextResponse.json({
      uid,
      email: decoded.email ?? userData?.email ?? null,
      displayName: decoded.name ?? userData?.displayName ?? null,
      stripeCustomerId: userData?.stripeCustomerId ?? null,
      createdAt: userData?.createdAt ?? null,
      updatedAt: userData?.updatedAt ?? null,
    });
  } catch {
    const response = NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    response.headers.set("set-cookie", buildClearCookieHeader());
    return response;
  }
}

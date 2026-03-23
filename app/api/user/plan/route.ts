import { NextResponse } from "next/server";
import { getAdminFirestore, INVOICES_SUBCOLLECTION, USERS_COLLECTION } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim();

  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const normalizedEmail = email.toLowerCase();

  try {
    const db = getAdminFirestore();
    const usersSnap = await db.collection(USERS_COLLECTION).where("email", "==", normalizedEmail).limit(1).get();
    if (usersSnap.empty) {
      return NextResponse.json({ plan: null, status: null, message: "No subscription found for this email" });
    }

    const userDoc = usersSnap.docs[0];
    const userData = userDoc.data();
    const latestInvoiceSnap = await db
      .collection(USERS_COLLECTION)
      .doc(userDoc.id)
      .collection(INVOICES_SUBCOLLECTION)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    const invoiceData = latestInvoiceSnap.empty ? null : latestInvoiceSnap.docs[0].data();
    const data = invoiceData ?? userData;

    return NextResponse.json({
      plan: data.plan ?? null,
      productId: data.productId ?? null,
      priceId: data.priceId ?? null,
      status: data.status ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      stripeCustomerId: (data.stripeCustomerId as string | undefined) ?? userData.stripeCustomerId ?? null,
      interval: data.interval ?? null,
      intervalCount: data.intervalCount ?? null,
      priceAmount: data.priceAmount ?? null,
      priceCurrency: data.priceCurrency ?? null,
      email: data.email ?? null,
      customerName: data.customerName ?? null,
      updatedAt: data.updatedAt ?? null,
      subscriptionId: data.subscriptionId ?? null,
      invoiceId: data.invoiceId ?? null,
      amount: data.amount ?? null,
      refundAlreadyUsed: data.refundAlreadyUsed ?? null,
      refundedAt: data.refundedAt ?? null,
      refundedBy: data.refundedBy ?? null,
      refundedReason: data.refundedReason ?? null,
      refundedAmount: data.refundedAmount ?? null,
      refundedCurrency: data.refundedCurrency ?? null,
      refundedStatus: data.refundedStatus ?? null,
      refundedType: data.refundedType ?? null,
      refundedMethod: data.refundedMethod ?? null,
    });
  } catch (err) {
    console.error("GET /api/user/plan error:", err);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

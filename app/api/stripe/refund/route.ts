import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const COLLECTION = "stripeCustomers";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const body = (await request.json()) as { subscriptionId?: string; cancelImmediately?: boolean };
    const { subscriptionId, cancelImmediately } = body;

    if (!subscriptionId || !String(subscriptionId).trim()) {
      return NextResponse.json({ success: false, message: "Missing subscriptionId" }, { status: 400 });
    }

    const subId = String(subscriptionId).trim();
    if (!subId.startsWith("sub_")) {
      return NextResponse.json({ success: false, message: "Invalid subscriptionId" }, { status: 400 });
    }

    const stripeSub = await stripe.subscriptions.retrieve(subId);
    const stripeCustomerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
    if (!stripeCustomerId) {
      return NextResponse.json({ success: false, message: "Subscription has no customer" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const directRef = db.collection(COLLECTION).doc(stripeCustomerId);
    const directSnap = await directRef.get();

    let customerDocs = directSnap.exists ? [directSnap] : [];
    if (!directSnap.exists) {
      const byField = await db.collection(COLLECTION).where("stripeCustomerId", "==", stripeCustomerId).limit(10).get();
      customerDocs = byField.docs;
    }

    const hasRefundBeenUsed =
      customerDocs.length > 0 && customerDocs.some((d) => (d.data() as { refundAlreadyUsed?: boolean }).refundAlreadyUsed === true);

    let refund: { id: string } | null = null;

    if (!hasRefundBeenUsed) {
      const latestInvoiceId = typeof stripeSub.latest_invoice === "string" ? stripeSub.latest_invoice : stripeSub.latest_invoice?.id;

      if (latestInvoiceId) {
        const latestInvoiceRaw = await stripe.invoices.retrieve(latestInvoiceId, {
          expand: ["payment_intent", "charge"],
        });
        const latestInvoice = latestInvoiceRaw as unknown as {
          paid?: boolean;
          status?: string;
          payment_intent?: string | { id?: string };
          charge?: string | { id?: string };
          customer?: string | { id?: string };
        };

        const invoicePaid = latestInvoice && (latestInvoice.paid === true || latestInvoice.status === "paid");

        if (invoicePaid) {
          const paymentIntentId = typeof latestInvoice.payment_intent === "string" ? latestInvoice.payment_intent : latestInvoice.payment_intent?.id;
          const chargeIdFromInvoice = typeof latestInvoice.charge === "string" ? latestInvoice.charge : latestInvoice.charge?.id;

          const pi = paymentIntentId && String(paymentIntentId).trim() ? paymentIntentId : null;
          const ch = chargeIdFromInvoice && String(chargeIdFromInvoice).trim() ? chargeIdFromInvoice : null;

          if (pi || ch) {
            try {
              if (pi) {
                refund = await stripe.refunds.create({ payment_intent: pi });
              } else if (ch) {
                refund = await stripe.refunds.create({ charge: ch });
              }
            } catch (refundErr) {
              console.error("Refund create failed", refundErr);
              throw refundErr;
            }
          } else {
            const customerId = typeof latestInvoice.customer === "string" ? latestInvoice.customer : (latestInvoice.customer as { id?: string })?.id;
            if (customerId) {
              const charges = await stripe.charges.list({ customer: customerId, limit: 1 });
              const latestCharge = charges.data[0];
              if (latestCharge) {
                refund = await stripe.refunds.create({ charge: latestCharge.id });
              }
            }
          }
        }
      }
    }

    let subscription: { status: string };
    if (cancelImmediately) {
      subscription = await stripe.subscriptions.cancel(subId);
    } else {
      subscription = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    }

    const now = Date.now();
    const updatePayload: Record<string, unknown> = {
      status: subscription.status,
      updatedAt: now,
      subscriptionId: subId,
    };
    if (refund) {
      updatePayload.refundAlreadyUsed = true;
      updatePayload.refundedAt = now;
    }

    if (customerDocs.length > 0) {
      await Promise.all(customerDocs.map((d) => d.ref.set(updatePayload, { merge: true })));
    } else {
      await directRef.set(updatePayload, { merge: true });
    }

    return NextResponse.json(
      {
        success: true,
        message: cancelImmediately ? "Subscription canceled." : "Subscription will cancel at end of billing period.",
        subscriptionId: subId,
        refunded: Boolean(refund),
      },
      { status: 200 },
    );
  } catch (error) {
    const is404 = error && typeof error === "object" && "statusCode" in error && (error as { statusCode?: number }).statusCode === 404;
    if (is404) {
      return NextResponse.json({ success: false, message: "Subscription not found or already canceled" }, { status: 404 });
    }
    console.error("POST /api/stripe/refund error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to process refund/cancel" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getAdminFirestore, USERS_COLLECTION, INVOICES_SUBCOLLECTION } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscriptionId } = body as { subscriptionId?: string };

  if (!subscriptionId || !subscriptionId.trim()) {
    return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
  }
  const subId = subscriptionId.trim();
  if (!subId.startsWith("sub_")) {
    return NextResponse.json({ error: "Invalid subscriptionId" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const db = getAdminFirestore();

    const stripeSub = await stripe.subscriptions.retrieve(subId);
    const stripeCustomerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "Missing Stripe customer on subscription" }, { status: 400 });
    }

    const usersByStripe = await db.collection(USERS_COLLECTION).where("stripeCustomerId", "==", stripeCustomerId).limit(10).get();
    const userDocs = usersByStripe.docs;

    const hasRefundBeenUsed =
      userDocs.length > 0 && userDocs.some((d) => (d.data() as { refundAlreadyUsed?: boolean }).refundAlreadyUsed === true);

    let refunded = false;
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
        [key: string]: unknown;
      };

      if (!hasRefundBeenUsed) {
        const invoicePaid = latestInvoice && (latestInvoice.paid === true || latestInvoice.status === "paid");

        if (invoicePaid) {
          const paymentIntentId = typeof latestInvoice.payment_intent === "string" ? latestInvoice.payment_intent : latestInvoice.payment_intent?.id;
          const chargeIdFromInvoice = typeof latestInvoice.charge === "string" ? latestInvoice.charge : latestInvoice.charge?.id;

          const pi = paymentIntentId && String(paymentIntentId).trim() ? paymentIntentId : null;
          const ch = chargeIdFromInvoice && String(chargeIdFromInvoice).trim() ? chargeIdFromInvoice : null;

          if (pi || ch) {
            try {
              if (pi) {
                await stripe.refunds.create({ payment_intent: pi });
                refunded = true;
              } else if (ch) {
                await stripe.refunds.create({ charge: ch });
                refunded = true;
              }
            } catch (refundErr) {
              console.error("Cancel: refund create failed", refundErr);
            }
          } else {
            const customerId = typeof latestInvoice.customer === "string" ? latestInvoice.customer : latestInvoice.customer?.id;
            if (customerId) {
              const charges = await stripe.charges.list({ customer: customerId, limit: 1 });
              const latestCharge = charges.data[0];
              if (latestCharge) {
                await stripe.refunds.create({ charge: latestCharge.id });
                refunded = true;
              }
            }
          }
        }
      }
    }

    const canceled = await stripe.subscriptions.cancel(subId);

    const now = Date.now();
    const updatePayload: Record<string, unknown> = {
      status: "canceled",
      updatedAt: now,
    };
    if (refunded) {
      updatePayload.refundAlreadyUsed = true;
      updatePayload.refundedAt = now;
    }

    if (userDocs.length > 0) {
      await Promise.all(userDocs.map((d) => d.ref.set(updatePayload, { merge: true })));
    }

    // Update existing invoice doc for this subscription: status = cancelled (no new doc)
    for (const userDoc of userDocs) {
      const uid = userDoc.id;
      const invoicesSnap = await db
        .collection(USERS_COLLECTION)
        .doc(uid)
        .collection(INVOICES_SUBCOLLECTION)
        .where("subscriptionId", "==", subId)
        .limit(1)
        .get();
      if (!invoicesSnap.empty) {
        const invoiceRef = invoicesSnap.docs[0].ref;
        const invoiceUpdate: Record<string, unknown> = {
          status: "canceled",
          updatedAt: now,
          cancelledAt: now,
        };
        if (refunded) {
          invoiceUpdate.refundAlreadyUsed = true;
          invoiceUpdate.refundedAt = now;
        }
        await invoiceRef.update(invoiceUpdate);
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      subscriptionId: subId,
      canceledSubscriptionId: canceled.id,
      refunded,
    });
  } catch (err) {
    const isStripe404 = err && typeof err === "object" && "statusCode" in err && (err as { statusCode?: number }).statusCode === 404;
    const isResourceMissing = err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "resource_missing";
    if (isStripe404 || isResourceMissing) {
      return NextResponse.json({ ok: false, error: "Subscription not found or already canceled", subscriptionId: subId }, { status: 404 });
    }
    console.error("POST /api/stripe/cancel error:", err);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}

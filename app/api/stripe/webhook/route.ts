import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminFirestore, USERS_COLLECTION, INVOICES_SUBCOLLECTION } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const COLLECTION = "stripeCustomers";

type CustomerPlanDoc = {
  email: string;
  customerName?: string | null;
  stripeCustomerId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  amount?: number | null;
  plan: string;
  productId: string;
  priceId: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  interval: string | null;
  intervalCount: number | null;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number | null;
  updatedAt: number;
  lastRefundedAt?: number | null;
  lastRefundId?: string | null;
  lastChargeId?: string | null;
};

async function upsertCustomer(stripeCustomerId: string, data: Partial<CustomerPlanDoc>) {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(stripeCustomerId);
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: Date.now(),
  };
  await ref.set(update, { merge: true });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  if (!webhookSecret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const rawBody = await req.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (!customerId) break;

        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["line_items.data.price.product", "subscription"],
        });

        const details = fullSession.customer_details ?? (session as { customer_details?: { email?: string; name?: string } }).customer_details;
        let email = session.customer_email ?? details?.email;
        if (!email) {
          const cust = await stripe.customers.retrieve(customerId);
          if (!cust.deleted && "email" in cust) email = cust.email ?? "";
        }
        const customerName = (details as { name?: string } | undefined)?.name ?? null;
        if (customerName) {
          try {
            await stripe.customers.update(customerId, { name: customerName });
          } catch {
            // ignore
          }
        }

        const emailNormalized = (email ?? "").trim().toLowerCase();

        const lineItem = fullSession.line_items?.data?.[0];
        const price = lineItem?.price;
        const product = price?.product;
        const productId = typeof product === "string" ? product : (product as Stripe.Product | undefined)?.id;
        const productName =
          typeof product === "object" && product && "name" in product ? String((product as Stripe.Product).name) : (productId ?? "");
        const priceId = price?.id ?? "";
        const priceAmount = price?.unit_amount ?? null;
        const priceCurrency = price?.currency ?? null;
        const interval = price?.recurring?.interval ?? null;
        const intervalCount = price?.recurring?.interval_count ?? null;

        const subscriptionIdFromSession =
          (fullSession.subscription &&
            (typeof fullSession.subscription === "string"
              ? fullSession.subscription
              : (fullSession.subscription as Stripe.Subscription | null)?.id)) ||
          (typeof session.subscription === "string" ? session.subscription : null);

        const subObj = fullSession.subscription as Stripe.Subscription | null | undefined;
        const invoiceIdFromSession =
          (subObj?.latest_invoice && (typeof subObj.latest_invoice === "string" ? subObj.latest_invoice : subObj.latest_invoice?.id)) ?? null;
        const amountFromSession = (fullSession as { amount_total?: number | null }).amount_total ?? null;

        await upsertCustomer(customerId, {
          email: emailNormalized || (email ?? ""),
          customerName: customerName ?? null,
          stripeCustomerId: customerId,
          subscriptionId: subscriptionIdFromSession ?? null,
          invoiceId: invoiceIdFromSession,
          amount: amountFromSession,
          plan: productName || "unknown",
          productId: productId ?? "",
          priceId,
          priceAmount,
          priceCurrency,
          interval,
          intervalCount,
          status: "active",
          currentPeriodEnd: fullSession.subscription
            ? (() => {
                const sub = fullSession.subscription as unknown as { current_period_end?: number } | undefined;
                return sub?.current_period_end ?? null;
              })()
            : null,
        });

        const uid = fullSession.metadata?.uid?.trim();
        const now = Date.now();
        const invoicePayload: Record<string, unknown> = {
          email: emailNormalized || (email ?? ""),
          customerName: customerName ?? null,
          stripeCustomerId: customerId,
          subscriptionId: subscriptionIdFromSession ?? null,
          invoiceId: invoiceIdFromSession,
          amount: amountFromSession,
          plan: productName || "unknown",
          productId: productId ?? "",
          priceId,
          priceAmount,
          priceCurrency,
          interval,
          intervalCount,
          status: "active",
          currentPeriodEnd: fullSession.subscription
            ? (() => {
                const sub = fullSession.subscription as unknown as { current_period_end?: number } | undefined;
                return sub?.current_period_end ?? null;
              })()
            : null,
          updatedAt: now,
        };
        if (uid) {
          const db = getAdminFirestore();
          await db.collection(USERS_COLLECTION).doc(uid).set(
            { stripeCustomerId: customerId, updatedAt: now },
            { merge: true }
          );
          await db.collection(USERS_COLLECTION).doc(uid).collection(INVOICES_SUBCOLLECTION).add(invoicePayload);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string }; amount_paid?: number };
        const subRef = invoice.subscription;
        const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        const item = subscription.items.data[0];
        const priceId = item?.price?.id ?? "";
        const productId = typeof item?.price?.product === "string" ? item.price.product : ((item?.price?.product as Stripe.Product)?.id ?? "");
        const priceAmount = item?.price?.unit_amount ?? null;
        const priceCurrency = item?.price?.currency ?? null;
        const interval = item?.price?.recurring?.interval ?? null;
        const intervalCount = item?.price?.recurring?.interval_count ?? null;

        const subPeriodEnd = (subscription as { current_period_end?: number }).current_period_end ?? null;
        const invoiceIdPaid = invoice.id ?? null;
        const amountPaid = invoice.amount_paid ?? null;

        await upsertCustomer(customerId, {
          stripeCustomerId: customerId,
          subscriptionId,
          invoiceId: invoiceIdPaid,
          amount: amountPaid,
          status: subscription.status === "trialing" ? "trialing" : "active",
          productId,
          priceId,
          priceAmount,
          priceCurrency,
          interval,
          intervalCount,
          currentPeriodEnd: subPeriodEnd,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoiceFail = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string } };
        const subRefFail = invoiceFail.subscription;
        const subscriptionId = typeof subRefFail === "string" ? subRefFail : subRefFail?.id;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        await upsertCustomer(customerId, {
          stripeCustomerId: customerId,
          status: "past_due",
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        const item = subscription.items.data[0];
        const priceId = item?.price?.id ?? "";
        const productId = typeof item?.price?.product === "string" ? item.price.product : ((item?.price?.product as Stripe.Product)?.id ?? "");
        const priceAmount = item?.price?.unit_amount ?? null;
        const priceCurrency = item?.price?.currency ?? null;
        const interval = item?.price?.recurring?.interval ?? null;
        const intervalCount = item?.price?.recurring?.interval_count ?? null;

        const subUpdatedPeriodEnd = (subscription as { current_period_end?: number }).current_period_end ?? null;
        await upsertCustomer(customerId, {
          stripeCustomerId: customerId,
          subscriptionId: subscription.id,
          status: subscription.status === "trialing" ? "trialing" : subscription.status === "active" ? "active" : "past_due",
          productId,
          priceId,
          priceAmount,
          priceCurrency,
          interval,
          intervalCount,
          currentPeriodEnd: subUpdatedPeriodEnd,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        await upsertCustomer(customerId, {
          stripeCustomerId: customerId,
          subscriptionId: subscription.id,
          status: "canceled",
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

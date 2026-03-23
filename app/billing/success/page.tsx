import { getStripe } from "@/lib/stripe";
import { getAdminFirestore, INVOICES_SUBCOLLECTION, USERS_COLLECTION } from "@/lib/firebase-admin";

async function resolveUidForBillingSync(params: {
  uidFromMetadata?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const uidFromMetadata = (params.uidFromMetadata ?? "").trim();
  if (uidFromMetadata) return uidFromMetadata;

  const normalizedEmail = (params.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const db = getAdminFirestore();
  const byEmail = await db.collection(USERS_COLLECTION).where("email", "==", normalizedEmail).limit(1).get();
  if (byEmail.empty) return null;
  return byEmail.docs[0].id;
}

async function syncPlanFromCheckoutSession(sessionId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "subscription"],
    });

    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!customerId) return false;

    const details = session.customer_details ?? undefined;
    let email = session.customer_email ?? details?.email ?? "";
    if (!email) {
      const cust = await stripe.customers.retrieve(customerId);
      if (!cust.deleted && "email" in cust) email = cust.email ?? "";
    }

    const emailNormalized = email.trim().toLowerCase();
    const customerName = details?.name ?? null;

    const lineItem = session.line_items?.data?.[0];
    const price = lineItem?.price;
    const product = price?.product;
    const productId = typeof product === "string" ? product : (product?.id ?? "");
    const productName = typeof product === "object" && product && "name" in product ? String(product.name) : productId || "unknown";
    const priceId = price?.id ?? "";
    const priceAmount = price?.unit_amount ?? null;
    const priceCurrency = price?.currency ?? null;
    const interval = price?.recurring?.interval ?? null;
    const intervalCount = price?.recurring?.interval_count ?? null;
    const now = Date.now();

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
    const subscriptionObj = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
    const invoiceId =
      (subscriptionObj?.latest_invoice &&
        (typeof subscriptionObj.latest_invoice === "string" ? subscriptionObj.latest_invoice : subscriptionObj.latest_invoice?.id)) ??
      null;

    const planDoc = {
      email: emailNormalized || email,
      customerName,
      stripeCustomerId: customerId,
      subscriptionId,
      invoiceId,
      amount: session.amount_total ?? null,
      plan: productName,
      productId,
      priceId,
      priceAmount,
      priceCurrency,
      interval,
      intervalCount,
      status: "active",
      currentPeriodEnd: subscriptionObj && "current_period_end" in subscriptionObj ? (subscriptionObj.current_period_end ?? null) : null,
      updatedAt: now,
    };

    const uid = await resolveUidForBillingSync({
      uidFromMetadata: session.metadata?.uid,
      email: emailNormalized || email,
    });
    if (!uid) return false;

    const db = getAdminFirestore();
    await db.collection(USERS_COLLECTION).doc(uid).set(
      {
        ...planDoc,
        stripeCustomerId: customerId,
        updatedAt: now,
      },
      { merge: true }
    );
    await db.collection(USERS_COLLECTION).doc(uid).collection(INVOICES_SUBCOLLECTION).add(planDoc);

    return true;
  } catch {
    return false;
  }
}

export default async function BillingSuccessPage(props: { searchParams?: Promise<{ session_id?: string }> }) {
  const searchParams = await props.searchParams;
  const sessionId = searchParams?.session_id;
  const synced = sessionId ? await syncPlanFromCheckoutSession(sessionId) : false;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Payment successful</h1>
      <p className="mt-3 text-sm text-gray-600">Thanks! We&apos;re processing your order. Your access will activate shortly.</p>
      {sessionId ? (
        <p className="mt-2 text-xs text-gray-500">{synced ? "Plan synced to Firebase." : "Sync pending (webhook fallback failed)."}</p>
      ) : null}
      {sessionId ? <p className="mt-6 rounded-lg bg-gray-50 px-4 py-3 font-mono text-xs text-gray-700">session_id: {sessionId}</p> : null}
      <a
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        href="/"
      >
        Back to pricing
      </a>
    </div>
  );
}

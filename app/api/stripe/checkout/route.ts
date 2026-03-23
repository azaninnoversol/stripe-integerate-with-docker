import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminFirestore, USERS_COLLECTION } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5000";
}

function getMode(): Stripe.Checkout.SessionCreateParams.Mode {
  const mode = process.env.STRIPE_CHECKOUT_MODE;
  if (mode === "payment" || mode === "subscription") return mode;
  return "subscription";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { priceId, email, name, uid } = body as { priceId?: string; email?: string; name?: string; uid?: string };
  if (!priceId) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  if (!priceId.startsWith("price_")) return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });

  const trimmedEmail = email && typeof email === "string" ? email.trim() : "";
  const trimmedName = name && typeof name === "string" ? name.trim() : "";

  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) return NextResponse.json({ error: "Price is not active" }, { status: 400 });

    let customerId: string | undefined;

    if (trimmedEmail) {
      const emailForStripe = trimmedEmail.toLowerCase();
      const existing = await stripe.customers.list({ email: emailForStripe, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        if (trimmedName) {
          await stripe.customers.update(customerId, { name: trimmedName });
        }
      } else {
        const newCustomer = await stripe.customers.create({
          email: emailForStripe,
          name: trimmedName || undefined,
        });
        customerId = newCustomer.id;
      }
    }

    // Persist a stable mapping early so plan lookup can fallback by uid even
    // when webhook delivery is delayed or missed in local development.
    if (customerId && uid) {
      const db = getAdminFirestore();
      await db.collection(USERS_COLLECTION).doc(uid).set(
        {
          email: trimmedEmail || null,
          stripeCustomerId: customerId,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: getMode(),
      ...(customerId ? { customer: customerId } : {}),
      ...(!customerId && trimmedEmail ? { customer_email: trimmedEmail } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      allow_promotion_codes: true,
      metadata: {
        ...(trimmedEmail && { email: trimmedEmail }),
        ...(uid && { uid }),
        priceId,
        productId: typeof price.product === "string" ? price.product : price.product.id,
      },
    });

    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

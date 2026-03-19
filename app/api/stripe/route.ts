import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stripe = getStripe();
    const products = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    return NextResponse.json({
      ok: true,
      count: products.data.length,
      products: products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        default_price: p.default_price,
        marketing_features_list: p?.marketing_features,
        metadata: p?.metadata,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

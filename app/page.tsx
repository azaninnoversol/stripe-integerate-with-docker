"use client";
import CardDetails from "@/components/card-details/card-details";
import PricingCard from "@/components/pricing-card/pricing-card";
import React from "react";

type StripePriceLike =
  | string
  | {
      id: string;
      unit_amount?: number | null;
      currency?: string;
      recurring?: { interval?: string; interval_count?: number | null } | null;
    };

type StripeProductLike = {
  id: string;
  name: string;
  description?: string | null;
  metadata?: { badge?: string } & Record<string, string>;
  default_price?: StripePriceLike;
  marketing_features_list?: { name: string }[];
};

type CardDetailsLike = {
  plan?: string | null;
  customerName?: string | null;
  email?: string | null;
  status?: string | null;
  subscriptionId?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
};

type UserPlanResponseLike = CardDetailsLike & {
  priceId?: string | null;
};

function Page() {
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<StripeProductLike[]>([]);
  const [productsLoaded, setProductsLoaded] = React.useState(false);
  const [authLoaded, setAuthLoaded] = React.useState(false);
  const [planLoaded, setPlanLoaded] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [checkoutEmail, setCheckoutEmail] = React.useState<string>("");
  const [checkoutName, setCheckoutName] = React.useState<string>("");
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [cardDetails, setCardDetails] = React.useState<CardDetailsLike | null>(null);
  const [user, setUser] = React.useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const subscriptionId = cardDetails?.subscriptionId ?? null;

  React.useEffect(() => {
    getProductsFromStripe();
  }, []);

  React.useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUser({ uid: data.uid, email: data.email ?? null, displayName: data.displayName ?? null });
        setCheckoutEmail((prev) => prev || data.email || "");
        setCheckoutName((prev) => prev || data.displayName || "");
      })
      .catch(() => {
        setUser(null);
        window.location.href = "/login";
      })
      .finally(() => setAuthLoaded(true));
  }, []);

  React.useEffect(() => {
    if (!authLoaded) return;

    if (!checkoutEmail) {
      setCardDetails(null);
      setSelectedPlan(null);
      setPlanLoaded(true);
      return;
    }

    setPlanLoaded(false);
    void getSelectedPlanFromFirebase(checkoutEmail);
  }, [checkoutEmail, authLoaded]);

  async function getSelectedPlanFromFirebase(checkoutEmail: string) {
    try {
      const res = await fetch(`/api/user/plan?email=${checkoutEmail}`);
      const data = (await res.json()) as UserPlanResponseLike;
      const status = (data?.status ?? "").toLowerCase();
      const isCancelled = status === "canceled" || status === "cancelled";
      const hasSubscription = Boolean(data?.subscriptionId);

      if (!hasSubscription && !isCancelled) {
        // No active subscription for this email.
        setCardDetails(null);
        setSelectedPlan(null);
      } else {
        // Even if canceled, keep showing details (status/period) if available.
        setCardDetails(data ?? null);
        setSelectedPlan(isCancelled ? null : (data?.priceId ?? null));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to get selected plan from Firebase");
    } finally {
      setPlanLoaded(true);
    }
  }

  async function getProductsFromStripe() {
    try {
      const res = await fetch("/api/stripe");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to get products from Stripe");
      setProducts((data.products ?? []) as StripeProductLike[]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to get products from Stripe");
    } finally {
      setProductsLoaded(true);
    }
  }

  function getDefaultPriceObject(defaultPrice: StripePriceLike | undefined) {
    return typeof defaultPrice === "string" ? null : (defaultPrice ?? null);
  }

  async function startCheckout(priceId: string, loadingId: string) {
    setLoadingKey(loadingId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          priceId,
          email: checkoutEmail || (user?.email ?? ""),
          name: checkoutName || (user?.displayName ?? undefined),
          uid: user?.uid,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      if (!data.url) throw new Error("Missing checkout URL");
      window.location.href = data.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed");
      setLoadingKey(null);
    }
  }

  function formatCardDetailsPrice(details: CardDetailsLike | null): string {
    if (!details) return "";
    const amount = details.priceAmount ?? null;
    const currency = details.priceCurrency ? details.priceCurrency.toUpperCase() : null;
    if (amount == null || !currency) return "";
    if (currency === "USD") {
      return `$${(amount / 100).toFixed(2)}`;
    }
    return `${amount} ${currency}`;
  }

  function formatCardDetailsInterval(details: CardDetailsLike | null): string {
    if (!details || !details.interval) return "";
    const count = details.intervalCount ?? 1;
    const unit = String(details.interval);
    return `${count} ${unit}`;
  }

  async function cancelCurrentPlan(subscriptionId: string) {
    if (!subscriptionId) return window.alert("No subscription ID found");

    setCancelLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });

      const data = (await res.json()) as { ok?: boolean; success?: boolean; error?: string; refunded?: boolean };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to cancel subscription");
      }

      if (data.refunded) {
        alert("Plan canceled. Refund will be processed (first-time refund).");
      } else {
        alert("Plan canceled.");
      }

      setCheckoutEmail("");
      setCheckoutName("");
      setSelectedPlan(null);
      setCardDetails(null);
      setLoadingKey(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to cancel plan");
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div
      id="payment-container"
      className="flex min-h-screen flex-col items-center justify-center gap-10 bg-linear-to-b from-white to-gray-50 px-6 py-16"
    >
      <nav className="absolute right-6 top-6 flex items-center gap-3 text-sm">
        <span className="text-gray-600">{user?.email ?? user?.displayName ?? "Logged in"}</span>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.href = "/login";
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
        >
          Log out
        </button>
      </nav>
      <h1 className="text-center text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Choose Your Plan</h1>

      {cancelLoading || !productsLoaded || !planLoaded ? (
        <div className="flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid w-full max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((plan) => {
            const dp = getDefaultPriceObject(plan.default_price);
            const priceId = dp?.id;
            const unitAmount = dp?.unit_amount ?? 0;
            const currency = dp?.currency ? dp.currency.toUpperCase() : undefined;
            const interval = dp?.recurring ? `${dp.recurring.interval_count ?? 1} ${dp.recurring.interval ?? ""}`.trim() : "";
            const loadingId = priceId ?? plan.id;

            return (
              <PricingCard
                key={plan.id}
                title={plan.name}
                description={plan.description ?? undefined}
                price={unitAmount}
                currency={currency}
                interval={interval}
                badge={plan?.metadata?.badge}
                features={plan?.marketing_features_list ?? []}
                ctaLabel="Get started"
                isLoading={loadingKey === loadingId}
                isCurrentPlan={Boolean(priceId && selectedPlan && priceId === selectedPlan)}
                disabled={Boolean(selectedPlan && priceId && priceId !== selectedPlan)}
                onCtaClick={
                  !priceId
                    ? undefined
                    : () => {
                        void startCheckout(priceId, loadingId);
                      }
                }
              />
            );
          })}
        </div>
      )}

      {productsLoaded && planLoaded && (
        <div className="w-full max-w-7xl mx-auto">
          <CardDetails
            title={cardDetails ? (cardDetails?.plan ?? "Current plan") : "No Active Plan"}
            description={
              cardDetails?.customerName
                ? `${cardDetails.customerName} · ${cardDetails?.email ?? checkoutEmail}`
                : (cardDetails?.email ?? checkoutEmail)
            }
            priceLabel={formatCardDetailsPrice(cardDetails)}
            intervalLabel={formatCardDetailsInterval(cardDetails)}
            statusLabel={cardDetails?.status ?? ""}
            features={[]}
            onCancel={subscriptionId ? () => cancelCurrentPlan(subscriptionId) : undefined}
          />
        </div>
      )}
    </div>
  );
}

export default Page;

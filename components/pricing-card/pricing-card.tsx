type PricingCardProps = {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  interval?: string | `${string}`;
  badge?: string;
  features?: { name: string }[];
  ctaLabel?: string;
  isLoading?: boolean;
  onCtaClick?: () => void;
  isCurrentPlan?: boolean;
  disabled?: boolean;
};

const PricingCard = ({
  title,
  description,
  price,
  currency = "$",
  interval = "",
  badge,
  features = [],
  ctaLabel = "Get started",
  isLoading = false,
  onCtaClick,
  isCurrentPlan = false,
  disabled = false,
}: PricingCardProps) => {
  return (
    <div
      className={`${isCurrentPlan ? "opacity-50 pointer-events-none cursor-none" : ""} relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm min-h-118`}
    >
      <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-blue-600/10 blur-2xl" />

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
          </div>
          {badge ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{badge}</span> : null}
        </div>

        <div className="mt-6 flex items-end gap-2">
          <p className="text-4xl font-bold tracking-tight text-gray-900">
            {currency === "USD" ? "$" : currency}
            {currency === "USD" ? Math.round(price / 100).toFixed(2) : price}
          </p>
          <p className="pb-1 text-sm text-gray-600">/ {interval}</p>
        </div>

        {features.length ? (
          <ul className="mt-6 space-y-3 text-sm text-gray-700">
            {features.map((feature) => (
              <li key={feature?.name} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-700">✓</span>
                <span>{feature?.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          className={`${isCurrentPlan ? "pointer-events-none cursor-none" : ""} mt-auto cursor-pointer inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
          onClick={isCurrentPlan ? undefined : onCtaClick}
          disabled={isLoading || disabled}
        >
          {isLoading ? "Redirecting..." : isCurrentPlan ? "Current Plan" : ctaLabel}
        </button>

        <p className="mt-2 text-center text-xs text-gray-500">Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
};

export default PricingCard;

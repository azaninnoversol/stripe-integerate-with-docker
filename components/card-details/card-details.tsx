import React from "react";

type CardDetailsProps = {
  title: string;
  description?: string;
  priceLabel: string;
  intervalLabel?: string;
  statusLabel?: string;
  features?: string[];
  onCancel?: () => void;
  onManage?: () => void;
};

function CardDetails({ title, description, priceLabel, intervalLabel, statusLabel, features = [], onCancel }: CardDetailsProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm w-full">
      <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-blue-600/10 blur-2xl" />

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
          </div>
          {statusLabel ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{statusLabel}</span> : null}
        </div>

        <div className="mt-6 flex items-end gap-2">
          <p className="text-3xl font-bold tracking-tight text-gray-900">{priceLabel}</p>
          {intervalLabel ? <p className="pb-1 text-sm text-gray-600">/ {intervalLabel}</p> : null}
        </div>

        {features.length ? (
          <ul className="mt-6 space-y-3 text-sm text-gray-700">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-700">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {onCancel ? (
          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              onClick={onCancel}
            >
              Cancel plan
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CardDetails;

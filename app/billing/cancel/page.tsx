export default function BillingCancelPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Payment cancelled</h1>
      <p className="mt-3 text-sm text-gray-600">No worries. You can try again anytime.</p>
      <a
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        href="/"
      >
        Back to pricing
      </a>
    </div>
  );
}


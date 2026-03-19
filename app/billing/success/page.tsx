export default async function BillingSuccessPage(props: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const searchParams = await props.searchParams;
  const sessionId = searchParams?.session_id;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Payment successful</h1>
      <p className="mt-3 text-sm text-gray-600">
        Thanks! We&apos;re processing your order. Your access will activate shortly (webhook based).
      </p>
      {sessionId ? (
        <p className="mt-6 rounded-lg bg-gray-50 px-4 py-3 font-mono text-xs text-gray-700">
          session_id: {sessionId}
        </p>
      ) : null}
      <a
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        href="/"
      >
        Back to pricing
      </a>
    </div>
  );
}


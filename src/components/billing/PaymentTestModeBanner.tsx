const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return <div role="note" className="w-full rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">Online payments aren't live yet. Please pay by bank transfer.</div>;
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div role="note" className="w-full rounded-md border border-gold/50 bg-gold/10 px-4 py-2 text-center text-sm text-gold">
        All payments made in the preview are in test mode.{" "}
        <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="font-medium underline">Read more</a>
      </div>
    );
  }
  return null;
}

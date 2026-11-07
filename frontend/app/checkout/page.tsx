"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, authApi, quoteApi, type AuthUser, type Quote } from "../../lib/api";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8"><p>Loading quote…</p></main>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId");
  const router = useRouter();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) { setLoading(false); return; }
    Promise.all([
      quoteApi.get(quoteId),
      authApi.me().then(({ user: u }) => u).catch(() => null),
    ])
      .then(([q, u]) => { setQuote(q); setUser(u); })
      .catch((err: Error) => setError(err.message || "Quote not found."))
      .finally(() => setLoading(false));
  }, [quoteId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await quoteApi.placeOrder(quote.quoteId, contactName, contactPhone);
      router.push(`/order?orderId=${encodeURIComponent(order.orderId)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        router.push(`/kyc/consent?returnTo=${encodeURIComponent(`/checkout?quoteId=${quote.quoteId}`)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to place order.");
      setSubmitting(false);
    }
  }

  if (!quoteId) return <main className="min-h-screen p-8"><p>Missing quote. Go back and select products.</p></main>;
  if (loading) return <main className="min-h-screen p-8"><p className="animate-pulse">Loading quote…</p></main>;
  if (!quote) return <main className="min-h-screen p-8"><p role="alert">{error ?? "Quote not found."}</p></main>;

  const contractEnd = new Date();
  contractEnd.setMonth(contractEnd.getMonth() + quote.contractMonths);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">

        <header className="space-y-1">
          <p className="text-sm text-gray-500">Udyam AI Advisor · Checkout</p>
          <h1 className="text-3xl font-semibold">Review your quote</h1>
        </header>

        {/* Quote summary */}
        <section className="rounded-2xl border p-6 space-y-4">
          <h2 className="font-semibold">Your bundle</h2>
          <ul className="divide-y text-sm">
            {quote.products.map((p) => (
              <li key={p.productId} className="py-3 flex justify-between gap-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-gray-500 text-xs">{p.category} · {p.unit}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">
                    ₹{p.monthlyPriceMin.toLocaleString("en-IN")}
                    {p.monthlyPriceMin !== p.monthlyPriceMax && `–₹${p.monthlyPriceMax.toLocaleString("en-IN")}`}
                    /mo
                  </p>
                  {p.setupFee > 0 && (
                    <p className="text-gray-400 text-xs">+₹{p.setupFee.toLocaleString("en-IN")} setup</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between font-semibold text-base">
              <span>Monthly total</span>
              <span>
                ₹{quote.totalMonthlyMin.toLocaleString("en-IN")}
                {quote.totalMonthlyMin !== quote.totalMonthlyMax && ` – ₹${quote.totalMonthlyMax.toLocaleString("en-IN")}`}
                /month
              </span>
            </div>
            {quote.totalSetupFee > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>One-time setup</span>
                <span>₹{quote.totalSetupFee.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>Contract length</span>
              <span>{quote.contractMonths} months (until {contractEnd.toLocaleDateString("en-IN", { month: "short", year: "numeric" })})</span>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border p-6 space-y-4">
            <h2 className="font-semibold">Contact details</h2>
            <p className="text-sm text-gray-500">Our team will call you to confirm installation timing.</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="name" className="text-sm font-medium">Your name</label>
                <input
                  id="name"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ramesh Kumar"
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="phone" className="text-sm font-medium">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          </section>

          {user && !user.kycVerified && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                KYC verification required
              </p>
              <p className="text-sm text-amber-700">
                Complete your business KYC before placing an order. It takes about 5 minutes.
              </p>
              <Link
                href={`/kyc/consent?returnTo=${encodeURIComponent(`/checkout?quoteId=${quoteId}`)}`}
                className="inline-block text-sm font-medium text-amber-800 underline underline-offset-4 hover:text-amber-900"
              >
                Complete KYC now →
              </Link>
            </div>
          )}

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-xl border py-3 text-sm font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !contactName.trim() || !contactPhone.trim() || (user != null && !user.kycVerified)}
              className="flex-1 rounded-xl bg-black text-white py-3 text-sm font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              {submitting ? "Placing order…" : "Place order →"}
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recommendationsApi, quoteApi, type ScoredProduct } from "../../lib/api";

function ProductCard({
  product,
  rank,
  selected,
  onToggle,
}: {
  product: ScoredProduct;
  rank?: number;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const isTop = rank !== undefined && rank < 3;
  return (
    <article
      className={`rounded-2xl border p-5 space-y-4 flex flex-col cursor-pointer transition-all ${
        selected ? "border-black ring-1 ring-black" : "opacity-70 hover:opacity-100"
      }`}
      onClick={() => onToggle(product.productId)}
    >
      <div className="space-y-1 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{product.category}</p>
          <div className="flex items-center gap-2 shrink-0">
            {isTop && <span className="text-xs font-medium">⭐ Top pick</span>}
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(product.productId)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 cursor-pointer"
            />
          </div>
        </div>
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        <p className="text-sm leading-6 text-gray-600">{product.description}</p>
        {product.matchReasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {product.matchReasons.map((r) => (
              <li key={r} className="text-xs text-gray-500 flex gap-1">
                <span>✓</span><span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-sm space-y-0.5 border-t pt-3">
        <p className="font-semibold text-base">
          ₹{product.monthlyPrice.min.toLocaleString("en-IN")}
          {product.monthlyPrice.min !== product.monthlyPrice.max && (
            <span className="font-normal text-gray-500"> – ₹{product.monthlyPrice.max.toLocaleString("en-IN")}</span>
          )}
          <span className="font-normal text-gray-500 text-sm"> / month</span>
        </p>
        <p className="text-gray-500">
          {product.unit}
          {product.setupFee > 0 ? ` · Setup ₹${product.setupFee.toLocaleString("en-IN")}` : " · No setup fee"}
        </p>
        <p className="text-gray-500">Install in ~{product.typicalInstallDays} days · {product.contractMonths}-month contract</p>
      </div>
    </article>
  );
}

function BundleSummary({ products }: { products: ScoredProduct[] }) {
  const top = products.slice(0, 3);
  const totalMin = top.reduce((s, p) => s + p.monthlyPrice.min, 0);
  const totalMax = top.reduce((s, p) => s + p.monthlyPrice.max, 0);
  const setupTotal = top.reduce((s, p) => s + p.setupFee, 0);
  return (
    <section className="rounded-2xl border p-5 space-y-3 bg-gray-50">
      <h2 className="font-semibold">Recommended bundle</h2>
      <ul className="space-y-1 text-sm">
        {top.map((p) => (
          <li key={p.productId} className="flex justify-between gap-4">
            <span>{p.name}</span>
            <span className="text-gray-500 shrink-0">
              ₹{p.monthlyPrice.min.toLocaleString("en-IN")}/mo
            </span>
          </li>
        ))}
        <li className="flex justify-between gap-4 font-semibold border-t pt-2 mt-2">
          <span>Bundle total</span>
          <span>
            ₹{totalMin.toLocaleString("en-IN")}
            {totalMin !== totalMax && ` – ₹${totalMax.toLocaleString("en-IN")}`}
            /month
          </span>
        </li>
        {setupTotal > 0 && (
          <li className="flex justify-between gap-4 text-gray-500">
            <span>One-time setup</span>
            <span>₹{setupTotal.toLocaleString("en-IN")}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8"><p>Loading recommendations...</p></main>}>
      <RecommendationsContent />
    </Suspense>
  );
}

function RecommendationsContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();

  const [recommendations, setRecommendations] = useState<ScoredProduct[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    recommendationsApi
      .get(sessionId)
      .then((data) => {
        setRecommendations(data.recommendations);
        setExplanation(data.explanation);
        // Pre-select top 3
        setSelectedIds(new Set(data.recommendations.slice(0, 3).map((p) => p.productId)));
      })
      .catch((err: Error) => setError(err.message || "Unable to load recommendations."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleGetQuote() {
    if (!sessionId || selectedIds.size === 0) return;
    setQuoteLoading(true);
    try {
      const quote = await quoteApi.create(sessionId, [...selectedIds]);
      router.push(`/checkout?quoteId=${encodeURIComponent(quote.quoteId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote.");
      setQuoteLoading(false);
    }
  }

  const selected = recommendations.filter((p) => selectedIds.has(p.productId));
  const totalMin = selected.reduce((s, p) => s + p.monthlyPrice.min, 0);
  const totalMax = selected.reduce((s, p) => s + p.monthlyPrice.max, 0);

  if (!sessionId) {
    return <main className="min-h-screen p-8"><p>Missing session. Go back and complete the advisor.</p></main>;
  }
  if (loading) {
    return <main className="min-h-screen p-8"><p className="animate-pulse">Finding the best products for your business…</p></main>;
  }
  if (error) {
    return <main className="min-h-screen p-8"><p role="alert">{error}</p></main>;
  }
  if (recommendations.length === 0) {
    return <main className="min-h-screen p-8"><p>No matching products found. Try adjusting your requirements.</p></main>;
  }

  const topRated = recommendations.slice(0, 3);
  const rest = recommendations.slice(3);

  return (
    <div className="min-h-screen pb-28">
      <main className="px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-10">

          <header className="space-y-2">
            <p className="text-sm text-gray-500">Udyam AI Advisor</p>
            <h1 className="text-3xl font-semibold">Your personalised recommendations</h1>
            {explanation && (
              <p className="text-base leading-7 text-gray-600 max-w-2xl">{explanation}</p>
            )}
            <p className="text-sm text-gray-400">Select the products you want, then get a quote.</p>
          </header>

          <BundleSummary products={selected.length > 0 ? selected : topRated} />

          <section className="space-y-4">
            <h2 className="font-semibold text-lg">⭐ Top picks for you</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topRated.map((product, i) => (
                <ProductCard
                  key={product.productId}
                  product={product}
                  rank={i}
                  selected={selectedIds.has(product.productId)}
                  onToggle={toggleProduct}
                />
              ))}
            </div>
          </section>

          {rest.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">More options</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((product) => (
                  <ProductCard
                    key={product.productId}
                    product={product}
                    selected={selectedIds.has(product.productId)}
                    onToggle={toggleProduct}
                  />
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Back to advisor
          </button>
        </div>
      </main>

      {/* Sticky quote bar */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-white px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div>
            {selectedIds.size === 0 ? (
              <p className="text-sm text-gray-400">Select at least one product</p>
            ) : (
              <>
                <p className="font-semibold">
                  ₹{totalMin.toLocaleString("en-IN")}
                  {totalMin !== totalMax && ` – ₹${totalMax.toLocaleString("en-IN")}`}
                  <span className="font-normal text-gray-500 text-sm"> / month</span>
                </p>
                <p className="text-xs text-gray-500">{selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleGetQuote}
            disabled={selectedIds.size === 0 || quoteLoading}
            className="rounded-xl bg-black text-white px-6 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            {quoteLoading ? "Creating quote…" : "Get quote →"}
          </button>
        </div>
      </div>
    </div>
  );
}

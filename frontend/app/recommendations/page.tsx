"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, recommendationsApi, quoteApi, type AuthUser, type ScoredProduct } from "../../lib/api";

function ProductCard({
  product,
  rank,
  selected,
  locked,
  missingDep,
  onToggle,
}: {
  product: ScoredProduct;
  rank?: number;
  selected: boolean;
  locked?: boolean;
  missingDep?: string;
  onToggle: (id: string) => void;
}) {
  const isTop = rank !== undefined && rank < 3;
  return (
    <article
      className={`rounded-2xl border p-5 space-y-4 flex flex-col transition-all ${
        locked
          ? "opacity-50 cursor-not-allowed"
          : selected
            ? "border-black ring-1 ring-black cursor-pointer"
            : "opacity-70 hover:opacity-100 cursor-pointer"
      }`}
      onClick={() => !locked && onToggle(product.productId)}
    >
      <div className="space-y-1 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{product.category}</p>
          <div className="flex items-center gap-2 shrink-0">
            {isTop && !locked && <span className="text-xs font-medium">⭐ Top pick</span>}
            {product.requiresGSTIN && (
              <span className={`text-xs font-medium border px-1.5 py-0.5 rounded ${locked ? "border-gray-400 text-gray-400" : "border-amber-500 text-amber-600"}`}>
                {locked ? "🔒 KYC required" : "KYC required"}
              </span>
            )}
            {missingDep && (
              <span className="text-xs font-medium border border-orange-400 text-orange-600 px-1.5 py-0.5 rounded">
                Needs broadband
              </span>
            )}
            {!locked && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(product.productId)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 cursor-pointer"
              />
            )}
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
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    Promise.all([
      recommendationsApi.get(sessionId),
      authApi.me().then(({ user: u }) => u).catch(() => null),
    ])
      .then(([data, u]) => {
        setUser(u);
        setRecommendations(data.recommendations);
        setExplanation(data.explanation);
        // Pre-select top 3 that user can actually select (skip GSTIN-locked ones)
        const selectable = data.recommendations.filter(
          (p) => !p.requiresGSTIN || u?.kycVerified,
        );
        setSelectedIds(new Set(selectable.slice(0, 3).map((p) => p.productId)));
      })
      .catch((err: Error) => setError(err.message || "Unable to load recommendations."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function toggleProduct(id: string) {
    const product = recommendations.find((p) => p.productId === id);
    if (product?.requiresGSTIN && !user?.kycVerified) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleGetQuote() {
    if (!sessionId || selectedIds.size === 0) return;

    // Client-side dependency check before API call
    for (const id of selectedIds) {
      const product = recommendations.find((p) => p.productId === id);
      if (product && product.requiredProducts.length > 0) {
        const satisfied = product.requiredProducts.some((dep) => selectedIds.has(dep));
        if (!satisfied) {
          const depNames = product.requiredProducts
            .map((dep) => recommendations.find((p) => p.productId === dep)?.name ?? dep)
            .join(" or ");
          setError(`${product.name} requires ${depNames} in the same bundle. Please add a compatible broadband product.`);
          return;
        }
      }
    }

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

          {recommendations.some((p) => p.requiresGSTIN && !user?.kycVerified) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              🔒 Some products require business KYC verification. <a href="/kyc/consent" className="font-medium underline underline-offset-4 hover:text-amber-900">Complete KYC</a> to unlock them.
            </div>
          )}

          <section className="space-y-4">
            <h2 className="font-semibold text-lg">⭐ Top picks for you</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topRated.map((product, i) => {
                const depMissing = product.requiredProducts.length > 0 && selectedIds.has(product.productId)
                  ? !product.requiredProducts.some((dep) => selectedIds.has(dep))
                  : false;
                return (
                  <ProductCard
                    key={product.productId}
                    product={product}
                    rank={i}
                    selected={selectedIds.has(product.productId)}
                    locked={product.requiresGSTIN && !user?.kycVerified}
                    missingDep={depMissing ? product.requiredProducts[0] : undefined}
                    onToggle={toggleProduct}
                  />
                );
              })}
            </div>
          </section>

          {rest.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-semibold text-lg">More options</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((product) => {
                  const depMissing = product.requiredProducts.length > 0 && selectedIds.has(product.productId)
                    ? !product.requiredProducts.some((dep) => selectedIds.has(dep))
                    : false;
                  return (
                    <ProductCard
                      key={product.productId}
                      product={product}
                      selected={selectedIds.has(product.productId)}
                      locked={product.requiresGSTIN && !user?.kycVerified}
                      missingDep={depMissing ? product.requiredProducts[0] : undefined}
                      onToggle={toggleProduct}
                    />
                  );
                })}
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
        {error && (
          <div className="mx-auto max-w-5xl mb-2">
            <p role="alert" className="text-sm text-red-600">{error}</p>
          </div>
        )}
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

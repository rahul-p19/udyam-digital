"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { quoteApi, type Order } from "../../lib/api";
import { getWhatsAppAdvisorUrl } from "@/lib/whatsapp";

const POLL_INTERVAL_MS = 30_000;

const STATUS_STEPS = [
  { key: "submitted", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "Installation" },
  { key: "activated", label: "Active" },
] as const;

type StatusKey = typeof STATUS_STEPS[number]["key"];

function StatusTracker({ status }: { status: Order["status"] }) {
  const activeIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= activeIdx && status !== "cancelled";
        const current = i === activeIdx && status !== "cancelled";
        return (
          <li key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                done ? "bg-black text-white" : "border text-gray-400"
              } ${current ? "ring-2 ring-black ring-offset-2" : ""}`}>
                {done && !current ? "✓" : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${done ? "font-medium" : "text-gray-400"}`}>{step.label}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${i < activeIdx && status !== "cancelled" ? "bg-black" : "bg-gray-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8"><p>Loading order…</p></main>}>
      <OrderContent />
    </Suspense>
  );
}

function OrderContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;

    async function fetchOrder() {
      try {
        const data = await quoteApi.getOrder(orderId!);
        if (cancelled) return;
        setOrder(data);
        setLoading(false);
        const terminal = data.status === "activated" || data.status === "cancelled";
        if (!terminal) {
          timerRef.current = setTimeout(fetchOrder, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Order not found.");
        setLoading(false);
      }
    }

    fetchOrder();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId]);

  if (!orderId) return <main className="min-h-screen p-8"><p>Missing order ID.</p></main>;
  if (loading) return <main className="min-h-screen p-8"><p className="animate-pulse">Loading order…</p></main>;
  if (!order) return <main className="min-h-screen p-8"><p role="alert">{error ?? "Order not found."}</p></main>;

  const isCancelled = order.status === "cancelled";
  const whatsappUrl = getWhatsAppAdvisorUrl(
    `Hi, I'd like to chat with the Udyam AI Advisor about order ${order.orderId.toUpperCase().slice(0, 8)}.`,
  );

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">

        <header className="space-y-1">
          <p className="text-sm text-gray-500">Udyam AI Advisor</p>
          <h1 className="text-3xl font-semibold">
            {isCancelled ? "Order cancelled" : "Order placed!"}
          </h1>
          {!isCancelled && (
            <p className="text-gray-600">
              Thank you, {order.contactName}. We'll call {order.contactPhone} to confirm installation.
            </p>
          )}
        </header>

        {/* Order ID */}
        <section className="rounded-2xl bg-gray-50 border p-5 space-y-1">
          <p className="text-xs text-gray-500">Order reference</p>
          <p className="font-mono text-sm font-semibold">{order.orderId.toUpperCase().slice(0, 8)}</p>
          <p className="text-xs text-gray-400">Placed on {new Date(order.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          {order.whatsapp?.status === "sent" && (
            <p className="text-xs text-green-700">Confirmation sent to your WhatsApp</p>
          )}
          {order.whatsapp?.status === "failed" && (
            <p className="text-xs text-amber-700">WhatsApp confirmation could not be sent</p>
          )}
        </section>

        {/* Status tracker */}
        {!isCancelled && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Order status</h2>
              {order.status !== "activated" && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  Live
                </span>
              )}
            </div>
            <StatusTracker status={order.status as StatusKey} />
            {order.estimatedActivationDate && (
              <p className="text-sm text-gray-500">
                Estimated activation by{" "}
                <span className="font-medium text-black">
                  {new Date(order.estimatedActivationDate).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </p>
            )}
          </section>
        )}

        {/* Bundle summary */}
        <section className="rounded-2xl border p-5 space-y-3">
          <h2 className="font-semibold">Your bundle</h2>
          <ul className="divide-y text-sm">
            {order.quote.products.map((p) => (
              <li key={p.productId} className="py-2.5 flex justify-between gap-4">
                <span>{p.name}</span>
                <span className="text-gray-500 shrink-0">
                  ₹{p.monthlyPriceMin.toLocaleString("en-IN")}/mo
                </span>
              </li>
            ))}
            <li className="py-2.5 flex justify-between gap-4 font-semibold">
              <span>Total</span>
              <span>
                ₹{order.quote.totalMonthlyMin.toLocaleString("en-IN")}
                {order.quote.totalMonthlyMin !== order.quote.totalMonthlyMax
                  ? ` – ₹${order.quote.totalMonthlyMax.toLocaleString("en-IN")}`
                  : ""}/month
              </span>
            </li>
          </ul>
        </section>

        <div className="flex gap-3">
          <Link
            href="/chat"
            className="flex-1 rounded-xl border py-3 text-sm font-medium text-center hover:bg-gray-50"
          >
            Back to advisor
          </Link>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-black py-3 text-sm font-medium text-center text-white hover:bg-gray-800"
            >
              Chat on WhatsApp
            </a>
          ) : null}
        </div>

      </div>
    </main>
  );
}

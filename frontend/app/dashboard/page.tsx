"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ApiError,
  authApi,
  quoteApi,
  type AuthUser,
  type Order,
} from "@/lib/api";

const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  submitted: "Submitted",
  confirmed: "Confirmed",
  in_progress: "Installation",
  activated: "Active",
  cancelled: "Cancelled",
};

function orderStatusClasses(status: Order["status"]): string {
  switch (status) {
    case "activated":
      return "border-ink bg-ink text-white";
    case "cancelled":
      return "border-ink/30 text-muted";
    default:
      return "border-accent text-accent";
  }
}

function orderReference(orderId: string): string {
  return orderId.toUpperCase().slice(0, 8);
}

function formatOrderTotal(order: Order): string {
  const { totalMonthlyMin, totalMonthlyMax } = order.quote;

  if (totalMonthlyMin === totalMonthlyMax) {
    return `₹${totalMonthlyMin.toLocaleString("en-IN")}/mo`;
  }

  return `₹${totalMonthlyMin.toLocaleString("en-IN")}–₹${totalMonthlyMax.toLocaleString("en-IN")}/mo`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersReloadToken, setOrdersReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch((err) => {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load your session",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let active = true;

    quoteApi
      .listOrders()
      .then(({ orders: currentOrders }) => {
        if (active) setOrders(currentOrders);
      })
      .catch((err) => {
        if (!active) return;

        setOrdersError(
          err instanceof Error ? err.message : "Unable to load your orders",
        );
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, ordersReloadToken]);

  function retryOrders() {
    setOrdersError(null);
    setOrdersLoading(true);
    setOrdersReloadToken((token) => token + 1);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Cookies are cleared by the server; continue to login either way.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader marker="Account / Dashboard" />

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <aside className="border-b-2 border-ink px-gutter py-10 lg:col-span-3 lg:border-b-0 lg:border-r-2 lg:py-16">
          <p className="text-label font-strong uppercase text-accent">
            03 / Account
          </p>
          <h1 className="mt-4 text-4xl font-[750] leading-none tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="mt-4 max-w-xs text-metadata text-muted">
            Your Udyam Digital workspace.
          </p>
        </aside>

        <div className="px-gutter py-10 lg:col-span-9 lg:py-16">
          {loading ? (
            <p className="text-metadata text-muted">
              Loading your session...
            </p>
          ) : error ? (
            <div className="max-w-md space-y-6 border-t-2 border-ink pt-6">
              <p
                role="alert"
                className="border-l-2 border-accent bg-surface px-3 py-2 text-metadata text-accent"
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="border-2 border-ink px-5 py-3 text-label font-strong uppercase text-ink hover:bg-ink hover:text-white"
              >
                Go to login
              </button>
            </div>
          ) : user ? (
            <div className="max-w-3xl">
              <div className="max-w-xl">
                <p className="text-label font-strong uppercase text-muted">
                  Signed in as
                </p>
                <p className="mt-2 border-b-2 border-ink pb-5 text-4xl font-[750] leading-none tracking-tight text-ink">
                  {user.name ?? user.email}
                </p>

                <dl className="divide-y divide-ink/15 border-b-2 border-ink">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                    <dt className="text-label font-strong uppercase text-muted">
                      Email
                    </dt>
                    <dd className="break-all text-metadata text-ink">
                      {user.email}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="mt-8 w-full border-2 border-accent bg-accent px-6 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>

              <section className="mt-14" aria-labelledby="kyc-heading">
                <div className="border-b-2 border-ink pb-4">
                  <p className="text-label font-strong uppercase text-accent">
                    02 / KYC
                  </p>
                  <h2
                    id="kyc-heading"
                    className="mt-2 text-3xl font-[750] leading-none tracking-tight text-ink"
                  >
                    Business verification
                  </h2>
                </div>

                {user.kycVerified ? (
                  <div className="mt-5 flex items-start gap-3 border-2 border-ink bg-ink p-5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-accent bg-accent text-label font-strong text-white">
                      ✓
                    </span>
                    <div>
                      <p className="text-metadata font-strong text-white">
                        KYC verified
                      </p>
                      <p className="mt-1 text-metadata text-white/70">
                        Your business documents have been verified. You can place orders.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 border-2 border-ink bg-surface p-5">
                    <p className="text-metadata font-strong text-ink">
                      KYC not completed
                    </p>
                    <p className="mt-1 max-w-md text-metadata text-muted">
                      Verify your business documents to place orders. The process takes about 5 minutes.
                    </p>
                    <Link
                      href="/kyc/consent"
                      className="mt-4 inline-flex border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
                    >
                      Start KYC verification →
                    </Link>
                  </div>
                )}
              </section>

              <section className="mt-14" aria-labelledby="my-orders-heading">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4">
                  <div>
                    <p className="text-label font-strong uppercase text-accent">
                      01 / Orders
                    </p>
                    <h2
                      id="my-orders-heading"
                      className="mt-2 text-3xl font-[750] leading-none tracking-tight text-ink"
                    >
                      My orders
                    </h2>
                  </div>
                  {orders && orders.length > 0 ? (
                    <span className="text-label font-strong uppercase text-muted">
                      {orders.length} {orders.length === 1 ? "order" : "orders"}
                    </span>
                  ) : null}
                </div>

                {ordersLoading ? (
                  <p className="mt-5 text-metadata text-muted">
                    Loading your orders...
                  </p>
                ) : ordersError ? (
                  <div className="mt-5 max-w-md space-y-4 border-l-2 border-accent bg-surface px-4 py-3">
                    <p role="alert" className="text-metadata text-accent">
                      {ordersError}
                    </p>
                    <button
                      type="button"
                      onClick={retryOrders}
                      className="border-2 border-ink px-4 py-2 text-label font-strong uppercase text-ink hover:bg-ink hover:text-white"
                    >
                      Try again
                    </button>
                  </div>
                ) : orders && orders.length > 0 ? (
                  <ul className="divide-y divide-ink/15 border-b-2 border-ink">
                    {orders.map((order) => (
                      <li key={order.orderId}>
                        <Link
                          href={`/order?orderId=${encodeURIComponent(order.orderId)}`}
                          className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-metadata font-strong text-ink">
                                #{orderReference(order.orderId)}
                              </span>
                              <span
                                className={`border px-1.5 py-0.5 text-[10px] font-strong uppercase tracking-wider ${orderStatusClasses(order.status)}`}
                              >
                                {ORDER_STATUS_LABELS[order.status]}
                              </span>
                            </div>
                            <p className="mt-2 truncate text-metadata text-muted">
                              {order.quote.products
                                .map((product) => product.name)
                                .join(", ")}
                            </p>
                            <p className="mt-1 text-label font-strong uppercase text-muted">
                              Placed{" "}
                              {new Date(order.submittedAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                              {order.estimatedActivationDate
                                ? ` · Activation by ${new Date(
                                    order.estimatedActivationDate,
                                  ).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-1">
                            <span className="text-metadata font-strong text-ink">
                              {formatOrderTotal(order)}
                            </span>
                            <span className="text-label font-strong uppercase text-accent group-hover:underline group-hover:underline-offset-4">
                              View order →
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-6 border-2 border-ink bg-surface p-6">
                    <p className="text-lead font-strong text-ink">
                      No orders yet.
                    </p>
                    <p className="mt-2 max-w-md text-metadata text-muted">
                      Chat with the advisor to get a bundle recommendation, then
                      place your first order.
                    </p>
                    <Link
                      href="/chat"
                      className="mt-5 inline-flex border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
                    >
                      Start with the advisor
                    </Link>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

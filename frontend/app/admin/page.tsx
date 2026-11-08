"use client";

import { useEffect, useState } from "react";
import { adminApi, type FunnelAnalytics } from "@/lib/api";
import { useAdminKey } from "./layout";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border-2 border-ink p-5">
      <p className="text-label font-strong uppercase text-muted">{label}</p>
      <p className="mt-2 text-4xl font-[750] leading-none tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-metadata text-muted">{sub}</p>}
    </div>
  );
}

const TIER_CLASSES: Record<string, string> = {
  HIGH: "border-accent text-accent",
  MED: "border-ink text-ink",
  LOW: "border-ink/30 text-muted",
};

export default function AdminDashboardPage() {
  const adminKey = useAdminKey();
  const [data, setData] = useState<FunnelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    adminApi
      .getFunnelAnalytics(adminKey)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [adminKey]);

  if (loading) return <main className="px-gutter py-10"><p className="text-metadata text-muted">Loading analytics…</p></main>;
  if (error) return <main className="px-gutter py-10"><p className="text-metadata text-accent" role="alert">{error}</p></main>;
  if (!data) return null;

  const { live, historical, propensityBreakdown } = data;

  const totalDropped = live.totalSessions - live.totalOrders;

  return (
    <main className="px-gutter py-10 space-y-12">

      {/* Page header */}
      <div>
        <p className="text-label font-strong uppercase text-accent">00 / Dashboard</p>
        <h1 className="mt-2 text-4xl font-[750] leading-none tracking-tight text-ink">Funnel analytics</h1>
        <p className="mt-2 text-metadata text-muted">
          Digital journey (prototype) vs. field-sales baseline · Apr–Jun 2026
        </p>
      </div>

      {/* Live funnel */}
      <section>
        <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">
          Digital journey — prototype
        </h2>
        <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink/10 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total sessions" value={live.totalSessions} />
          <StatCard label="Profile complete" value={live.profileComplete} sub={live.totalSessions > 0 ? `${Math.round(live.profileComplete / live.totalSessions * 100)}% conversion` : undefined} />
          <StatCard label="Reached quote" value={live.totalQuotes} sub={live.profileComplete > 0 ? `${Math.round(live.totalQuotes / live.profileComplete * 100)}% of complete` : undefined} />
          <StatCard label="Orders placed" value={live.totalOrders} sub={live.totalSessions > 0 ? `${Math.round(live.totalOrders / live.totalSessions * 100)}% end-to-end` : undefined} />
          <StatCard label="Dropped in advisor" value={live.droppedInAdvisor} />
          <StatCard label="Dropped at checkout" value={live.droppedAtCheckout} />
        </div>
      </section>

      {/* Propensity of live dropped leads */}
      {propensityBreakdown.length > 0 && (
        <section>
          <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">
            Dropped leads — call-back priority
          </h2>
          <p className="mb-4 text-metadata text-muted max-w-2xl">
            Scored on profile completeness, services identified, budget, locations, and team size.
            GSTIN-linked businesses activate at <span className="text-ink font-strong">9.6%</span> vs <span className="text-ink font-strong">2.0%</span> without — HIGH-tier leads are most likely to convert with one follow-up call.
          </p>
          <div className="flex gap-3 flex-wrap">
            {(["HIGH", "MED", "LOW"] as const).map((tier) => {
              const row = propensityBreakdown.find((r) => r.tier === tier);
              const count = row?.count ?? 0;
              return (
                <div key={tier} className={`border-2 px-6 py-4 min-w-[120px] text-center ${TIER_CLASSES[tier]}`}>
                  <p className="text-label font-strong uppercase">{tier} priority</p>
                  <p className="mt-2 text-4xl font-[750] leading-none">{count}</p>
                  <p className="mt-1 text-label text-muted">
                    {totalDropped > 0 ? `${Math.round(count / totalDropped * 100)}%` : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Historical funnel */}
      {historical.stages.length > 0 && (
        <section>
          <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">
            Baseline — field sales, Apr–Jun 2026 · 5,000 leads
          </h2>
          <div className="overflow-x-auto border-2 border-ink">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-ink bg-surface">
                <tr>
                  {["Stage", "Count", "% of total leads"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-label font-strong uppercase text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {historical.stages.map((stage) => (
                  <tr key={stage.label} className={stage.label === "Activated" ? "bg-surface" : ""}>
                    <td className="px-4 py-3 text-metadata font-strong text-ink">{stage.label}</td>
                    <td className="px-4 py-3 text-metadata text-ink font-[600]">{stage.count.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      {stage.pct === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-ink/10">
                            <div className="h-full bg-accent" style={{ width: `${stage.pct}%` }} />
                          </div>
                          <span className="text-metadata text-ink">{stage.pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Key metrics + drop reasons + segments */}
      <div className="grid gap-8 lg:grid-cols-3">

        {/* Key metrics */}
        <section>
          <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">Baseline metrics to beat</h2>
          <dl className="space-y-3">
            {[
              { label: "Avg days to activation", value: `${historical.avgDaysToActivation} days` },
              { label: "Avg acquisition cost", value: `₹${historical.avgAcquisitionCost.toLocaleString("en-IN")}` },
              { label: "Activation rate (GSTIN)", value: `${historical.gstinActivationRate}%`, highlight: true },
              { label: "Activation rate (no GSTIN)", value: `${historical.noGstinActivationRate}%` },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-3">
                <dt className="text-metadata text-muted">{label}</dt>
                <dd className={`text-metadata font-[600] shrink-0 ${highlight ? "text-accent" : "text-ink"}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Drop reasons */}
        {historical.dropReasons.length > 0 && (
          <section>
            <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">Top drop reasons</h2>
            <ul className="space-y-2">
              {historical.dropReasons.map(({ reason, count }) => (
                <li key={reason} className="flex items-baseline justify-between gap-3">
                  <span className="text-metadata text-ink">{reason}</span>
                  <span className="text-metadata font-[600] text-muted shrink-0">{count.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Segment breakdown */}
        {historical.segmentBreakdown.length > 0 && (
          <section>
            <h2 className="mb-4 text-label font-strong uppercase text-muted border-b-2 border-ink pb-2">Segment activation rates</h2>
            <ul className="space-y-3">
              {historical.segmentBreakdown.map(({ segment, total, activated, activationRate }) => (
                <li key={segment}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-metadata text-ink">{segment}</span>
                    <span className="text-metadata font-[600] text-ink shrink-0">{activationRate}%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-ink/10">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(activationRate * 5, 100)}%` }} />
                    </div>
                    <span className="text-label text-muted shrink-0">{activated}/{total}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

    </main>
  );
}

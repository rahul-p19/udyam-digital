"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminLead } from "@/lib/api";
import { useAdminKey } from "../layout";

const DROP_STAGE_LABELS: Record<AdminLead["dropStage"], string> = {
  advisor: "In advisor",
  quote_or_checkout: "Quote / checkout",
  ordered: "Ordered ✓",
};

const DROP_STAGE_CLASSES: Record<AdminLead["dropStage"], string> = {
  advisor: "border-ink/30 text-muted",
  quote_or_checkout: "border-accent text-accent",
  ordered: "border-ink bg-ink text-white",
};

function relative(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1 hr ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminLeadsPage() {
  const adminKey = useAdminKey();
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "dropped">("dropped");

  useEffect(() => {
    if (!adminKey) return;
    adminApi
      .listLeads(adminKey)
      .then(({ leads: data }) => setLeads(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [adminKey]);

  const filtered = leads.filter((l) =>
    filter === "all" ? true : !l.hasOrder,
  );

  const dropped = leads.filter((l) => !l.hasOrder).length;
  const ordered = leads.filter((l) => l.hasOrder).length;

  return (
    <main className="px-gutter py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label font-strong uppercase text-accent">01 / Leads</p>
          <h1 className="mt-2 text-4xl font-[750] leading-none tracking-tight text-ink">
            Dropped leads
          </h1>
          <p className="mt-2 text-metadata text-muted">
            Businesses that started the advisor but did not complete an order.
          </p>
        </div>
        <div className="flex gap-2 text-label font-strong uppercase">
          <span className="border-2 border-ink px-3 py-1.5 text-ink">{dropped} dropped</span>
          <span className="border-2 border-ink/30 px-3 py-1.5 text-muted">{ordered} ordered</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["dropped", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`border-2 px-4 py-1.5 text-label font-strong uppercase ${
              filter === f ? "border-ink bg-ink text-white" : "border-ink/30 text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {f === "dropped" ? "Dropped only" : "All sessions"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-metadata text-muted">Loading leads…</p>
      ) : error ? (
        <p className="text-metadata text-accent" role="alert">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-metadata text-muted">No leads found.</p>
      ) : (
        <div className="overflow-x-auto border-2 border-ink">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-ink bg-surface">
              <tr>
                {["Session", "Business type", "Employees", "Locations", "Services", "Messages", "Drop stage", "Last active"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-label font-strong uppercase text-muted whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {filtered.map((lead) => (
                <tr key={lead.sessionId} className="hover:bg-surface">
                  <td className="px-4 py-3 font-mono text-label text-muted">
                    {lead.sessionId.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-metadata text-ink">
                    {lead.businessType ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-metadata text-ink">
                    {lead.employeeCount ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-metadata text-ink">
                    {lead.locationCount ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-metadata text-ink max-w-[200px]">
                    {lead.requirements.length > 0
                      ? lead.requirements.slice(0, 2).join(", ") + (lead.requirements.length > 2 ? ` +${lead.requirements.length - 2}` : "")
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-metadata text-ink text-center">
                    {lead.messageCount}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`border px-1.5 py-0.5 text-[10px] font-strong uppercase tracking-wider whitespace-nowrap ${DROP_STAGE_CLASSES[lead.dropStage]}`}>
                      {DROP_STAGE_LABELS[lead.dropStage]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-metadata text-muted whitespace-nowrap">
                    {relative(lead.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

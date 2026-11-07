"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminKycCase } from "@/lib/api";
import { useAdminKey } from "../layout";

export default function AdminKycQueuePage() {
  const adminKey = useAdminKey();
  const [queue, setQueue] = useState<AdminKycCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminKycCase | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!adminKey) return;
    adminApi
      .listKycQueue(adminKey)
      .then(({ queue: data }) => setQueue(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [adminKey]);

  async function handleDecision(verificationId: string, decision: "approve" | "reject") {
    setActing(true);
    try {
      if (decision === "approve") {
        await adminApi.approveKyc(adminKey, verificationId);
      } else {
        await adminApi.rejectKyc(adminKey, verificationId);
      }
      setQueue((prev) => prev.filter((c) => c.id !== verificationId));
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="px-gutter py-10">
      <div className="mb-8">
        <p className="text-label font-strong uppercase text-accent">02 / KYC</p>
        <h1 className="mt-2 text-4xl font-[750] leading-none tracking-tight text-ink">
          Manual review queue
        </h1>
        <p className="mt-2 text-metadata text-muted">
          KYC cases that failed automated checks and need a human decision.
        </p>
      </div>

      {loading ? (
        <p className="text-metadata text-muted">Loading queue…</p>
      ) : error ? (
        <p className="text-metadata text-accent" role="alert">{error}</p>
      ) : queue.length === 0 ? (
        <div className="border-2 border-ink bg-surface p-6">
          <p className="text-lead font-strong text-ink">Queue is empty.</p>
          <p className="mt-1 text-metadata text-muted">All KYC cases have been reviewed.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Queue list */}
          <div className="space-y-2">
            {queue.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`w-full text-left border-2 p-4 transition-colors ${
                  selected?.id === item.id ? "border-accent bg-surface" : "border-ink/20 hover:border-ink"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-metadata font-strong text-ink">{item.userEmail}</p>
                    {item.extracted.gst.legalName && (
                      <p className="mt-0.5 text-metadata text-muted">{item.extracted.gst.legalName}</p>
                    )}
                    {item.extracted.gst.gstin && (
                      <p className="mt-0.5 font-mono text-label text-muted">{item.extracted.gst.gstin}</p>
                    )}
                  </div>
                  <span className="shrink-0 border border-accent px-1.5 py-0.5 text-[10px] font-strong uppercase tracking-wider text-accent">
                    {(item.failedChecks ?? 0)} failed
                  </span>
                </div>
                <p className="mt-2 text-label text-muted">
                  Submitted {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="border-2 border-ink p-5 space-y-5">
              <div>
                <p className="text-label font-strong uppercase text-accent">Review case</p>
                <p className="mt-1 text-metadata font-strong text-ink">{selected.userEmail}</p>
                {selected.extracted.gst.legalName && (
                  <p className="text-metadata text-muted">{selected.extracted.gst.legalName}</p>
                )}
              </div>

              {/* Extracted data */}
              <div className="border-t-2 border-ink pt-4 space-y-3">
                <p className="text-label font-strong uppercase text-muted">Extracted data</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ["GSTIN", selected.extracted.gst.gstin],
                    ["GST status", selected.extracted.gst.status],
                    ["Legal name", selected.extracted.gst.legalName],
                    ["Trade name", selected.extracted.gst.tradeName],
                    ["Udyam no.", selected.extracted.udyam.udyamNumber],
                    ["Enterprise", selected.extracted.udyam.enterpriseName],
                    ["Type", selected.extracted.udyam.enterpriseType],
                    ["State / City", [selected.extracted.udyam.state, selected.extracted.udyam.city].filter(Boolean).join(", ") || null],
                    ["Signatory", selected.extracted.signatory.name],
                    ["ID (masked)", selected.extracted.signatory.idMasked],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-label font-strong uppercase text-muted">{label}</dt>
                      <dd className="mt-0.5 text-metadata text-ink font-mono">{value ?? <span className="text-muted font-sans">—</span>}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Checks */}
              <div className="border-t-2 border-ink pt-4 space-y-2">
                <p className="text-label font-strong uppercase text-muted">Verification checks</p>
                <ul className="space-y-1">
                  {selected.checks.map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-metadata">
                      <span className={`mt-0.5 shrink-0 font-strong ${c.passed ? "text-ink" : "text-accent"}`}>
                        {c.passed ? "✓" : "✗"}
                      </span>
                      <div>
                        <span className={c.passed ? "text-ink" : "text-accent font-strong"}>{c.label}</span>
                        {c.detail && !c.passed && (
                          <p className="text-label text-muted">{c.detail}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="border-t-2 border-ink pt-4 flex gap-3">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => handleDecision(selected.id, "approve")}
                  className="flex-1 border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:opacity-50"
                >
                  {acting ? "Saving…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => handleDecision(selected.id, "reject")}
                  className="flex-1 border-2 border-ink px-5 py-3 text-label font-strong uppercase text-ink hover:bg-ink hover:text-white disabled:opacity-50"
                >
                  {acting ? "Saving…" : "Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, kycApi, type KycVerification } from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;

export default function VerificationDetails({
  verificationId,
}: {
  verificationId: string;
}) {
  const [verification, setVerification] = useState<KycVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const response = await kycApi.getVerification(verificationId);
        if (cancelled) return;
        setVerification(response.verification);
        setError(null);
        setLoading(false);
        // Keep polling only while still in manual review
        if (response.verification.status === "manual_review") {
          timerRef.current = setTimeout(fetchStatus, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "We could not load the detailed verification result.",
        );
        setLoading(false);
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [verificationId]);

  const failedChecks =
    verification?.checks.filter((check) => !check.passed) ?? [];

  if (!loading && verification?.status === "verified") {
    return (
      <div className="mt-5 border-2 border-accent bg-ink p-5 text-white">
        <span className="flex h-8 w-8 items-center justify-center border-2 border-accent bg-accent text-label font-strong text-white">
          ✓
        </span>
        <p className="mt-3 text-metadata font-strong text-white">KYC approved</p>
        <p className="mt-1 text-metadata text-white/70">
          An agent has reviewed and approved your business KYC. You can now place your order.
        </p>
        <a
          href="/dashboard"
          className="mt-4 inline-flex border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
        >
          Go to dashboard →
        </a>
      </div>
    );
  }

  if (!loading && verification?.status === "rejected") {
    return (
      <div className="mt-5 border-l-2 border-accent bg-surface p-4">
        <p className="text-metadata font-strong text-accent">KYC not approved</p>
        <p className="mt-1 text-metadata text-muted">
          An agent reviewed your documents and was unable to verify your business.
          Please re-upload clear, valid documents and try again.
        </p>
        <a
          href="/kyc/verify"
          className="mt-4 inline-flex border-2 border-accent px-5 py-3 text-label font-strong uppercase text-accent hover:bg-accent hover:text-white"
        >
          Re-upload documents
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5 border-l-2 border-accent bg-surface p-4">
      <h2 className="text-metadata font-strong text-accent">
        Why automatic KYC failed
      </h2>

      {loading ? (
        <p role="status" className="mt-2 text-metadata text-muted">
          Loading the verification details...
        </p>
      ) : null}

      {!loading && verification?.status === "manual_review" ? (
        <p className="mt-1 flex items-center gap-2 text-label font-strong uppercase text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Under review — checking every 20 seconds
        </p>
      ) : null}

      {!loading && error ? (
        <p className="mt-2 text-metadata text-muted">
          {error} An agent will still review your case manually.
        </p>
      ) : null}

      {!loading && !error && failedChecks.length > 0 ? (
        <>
          <p className="mt-1 text-metadata text-muted">
            These automated checks did not pass:
          </p>
          <ul className="mt-3 divide-y divide-ink/15 border-y border-ink/15">
            {failedChecks.map((check) => (
              <li key={check.key} className="bg-ground px-3 py-2.5">
                <p className="text-metadata font-strong text-ink">
                  {check.label}
                </p>
                {check.detail ? (
                  <p className="mt-0.5 text-metadata text-muted">
                    {check.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 border border-ink/15 bg-ground px-3 py-2.5">
            <p className="text-metadata font-strong text-ink">
              What you can do
            </p>
            <ul className="mt-2 space-y-1.5 text-metadata text-muted">
              <li>Upload a clear, full-page scan or photo.</li>
              <li>
                Make sure the name and address match your business records.
              </li>
              <li>Check that your GST registration is active.</li>
            </ul>
          </div>
        </>
      ) : null}

      {!loading && !error && failedChecks.length === 0 ? (
        <p className="mt-2 text-metadata text-muted">
          No failed automated checks were recorded. An agent will review your
          case manually.
        </p>
      ) : null}
    </div>
  );
}

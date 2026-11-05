"use client";

import { useEffect, useState } from "react";
import { ApiError, kycApi, type KycVerification } from "@/lib/api";

export default function VerificationDetails({
  verificationId,
}: {
  verificationId: string;
}) {
  const [verification, setVerification] = useState<KycVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    kycApi
      .getVerification(verificationId)
      .then((response) => {
        if (!cancelled) {
          setVerification(response.verification);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setVerification(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "We could not load the detailed verification result.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [verificationId]);

  const failedChecks =
    verification?.checks.filter((check) => !check.passed) ?? [];

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

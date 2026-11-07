"use client";

import { useEffect, useState } from "react";
import {
  createDigilockerDocuments,
  digilockerDemoProfile,
  digilockerDocumentList,
  type DigilockerFetchedDocument,
} from "@/lib/digilocker-mock";

type Stage = "signin" | "consent" | "fetching" | "success";

function DigilockerWordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#0076A9] text-lg font-bold text-white">
        d
      </span>
      <span className="text-lg font-bold tracking-tight">
        <span className="text-[#0076A9]">Digi</span>
        <span className="text-[#F58220]">Locker</span>
      </span>
    </div>
  );
}

function AppBadge() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink bg-ink text-label font-strong text-white">
      UD
    </span>
  );
}

export function DigilockerModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (documents: DigilockerFetchedDocument[]) => void;
}) {
  const [stage, setStage] = useState<Stage>("signin");
  const [mobile, setMobile] = useState(digilockerDemoProfile.mobile);
  const [fetched, setFetched] = useState<DigilockerFetchedDocument[]>([]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (stage !== "fetching") {
      return;
    }

    const timer = window.setTimeout(() => setStage("success"), 1500);
    return () => window.clearTimeout(timer);
  }, [stage]);

  function handleAllow() {
    setFetched(createDigilockerDocuments());
    setStage("fetching");
  }

  function handleFinish() {
    onComplete(fetched);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="digilocker-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border-2 border-ink bg-white shadow-[8px_8px_0_0_rgba(17,17,17,0.9)]"
      >
        <div className="flex items-center gap-2 border-b border-ink/15 bg-[#f2f4f7] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-ink/10 bg-white px-2 py-1">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-3 w-3 shrink-0 text-[#3c8f5a]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="5" y="11" width="14" height="10" rx="1" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="truncate text-[11px] text-muted">
              accounts.digilocker.gov.in/oauth2/authorize
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close DigiLocker window"
            className="flex h-6 w-6 items-center justify-center text-base text-muted hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-[#0076A9]/15 bg-white px-5 py-4">
          <DigilockerWordmark />
          <span className="border border-[#0076A9]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0076A9]">
            Sandbox
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {stage === "signin" ? (
            <div className="px-5 py-6 sm:px-7">
              <p className="text-label font-strong uppercase tracking-wider text-[#0076A9]">
                Authorised partner
              </p>
              <h2
                id="digilocker-title"
                className="mt-2 text-2xl font-bold leading-tight text-ink"
              >
                Sign in to DigiLocker
              </h2>
              <p className="mt-2 text-metadata text-muted">
                Use your DigiLocker account to securely share documents with
                Udyam Digital.
              </p>

              <label
                htmlFor="digilocker-mobile"
                className="mt-6 block text-metadata font-strong text-ink"
              >
                Mobile number
              </label>
              <div className="mt-2 flex items-stretch border border-ink/25 focus-within:border-[#0076A9]">
                <span className="flex items-center border-r border-ink/15 bg-[#f7f8fa] px-3 text-metadata text-muted">
                  +91
                </span>
                <input
                  id="digilocker-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  className="w-full px-3 py-2.5 text-body outline-none"
                  placeholder="Enter mobile number"
                />
              </div>

              <div className="mt-4 border border-dashed border-[#0076A9]/30 bg-[#f4fafd] px-3 py-2 text-metadata text-[#0076A9]">
                Demo mode: any mobile number works and no OTP is sent.
              </div>

              <button
                type="button"
                onClick={() => setStage("consent")}
                className="mt-5 w-full bg-[#0076A9] px-5 py-3 text-label font-strong uppercase tracking-wider text-white hover:bg-[#005b8f]"
              >
                Continue
              </button>

              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-ink/10" />
                <span className="text-[11px] uppercase tracking-wider text-muted">
                  or
                </span>
                <span className="h-px flex-1 bg-ink/10" />
              </div>

              <button
                type="button"
                disabled
                className="mt-4 w-full border border-ink/20 px-5 py-2.5 text-metadata font-strong text-muted"
              >
                Sign in with Aadhaar
              </button>

              <p className="mt-5 text-center text-metadata text-muted">
                New to DigiLocker?{" "}
                <span className="font-strong text-[#0076A9]">
                  Create an account
                </span>
              </p>
            </div>
          ) : null}

          {stage === "consent" ? (
            <div className="px-5 py-6 sm:px-7">
              <h2
                id="digilocker-title"
                className="text-xl font-bold leading-tight text-ink"
              >
                Udyam Digital is requesting access
              </h2>
              <p className="mt-2 text-metadata text-muted">
                {digilockerDemoProfile.name} · Aadhaar{" "}
                {digilockerDemoProfile.aadhaar}
              </p>

              <div className="mt-5 flex items-center gap-3 border border-ink/15 bg-[#f7f8fa] p-3">
                <AppBadge />
                <div>
                  <p className="text-metadata font-strong text-ink">
                    Udyam Digital
                  </p>
                  <p className="text-metadata text-muted">
                    Business KYC verification
                  </p>
                </div>
              </div>

              <p className="mt-5 text-metadata font-strong text-ink">
                The following documents will be shared:
              </p>
              <ul className="mt-2 divide-y divide-ink/10 border border-ink/15">
                {digilockerDocumentList.map((document) => (
                  <li key={document.key} className="flex gap-3 p-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[#28a745] text-[11px] font-bold text-white">
                      ✓
                    </span>
                    <div>
                      <p className="text-metadata font-strong text-ink">
                        {document.label}
                      </p>
                      <p className="text-metadata text-muted">
                        {document.description}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[#0076A9]">
                        Issued by {document.issuer}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-metadata text-muted">
                Udyam Digital will use these documents only for identity
                verification and regulatory compliance. You can revoke access at
                any time.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-ink/25 px-5 py-3 text-label font-strong uppercase tracking-wider text-ink hover:bg-[#f7f8fa]"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={handleAllow}
                  className="flex-1 bg-[#0076A9] px-5 py-3 text-label font-strong uppercase tracking-wider text-white hover:bg-[#005b8f]"
                >
                  Allow access
                </button>
              </div>
            </div>
          ) : null}

          {stage === "fetching" ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#0076A9]/20 border-t-[#0076A9]" />
              <h2
                id="digilocker-title"
                className="mt-5 text-xl font-bold text-ink"
              >
                Fetching your documents
              </h2>
              <p className="mt-2 max-w-sm text-metadata text-muted">
                Connecting to DigiLocker and securely downloading the documents
                you approved. This may take a few seconds.
              </p>
              <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-[#0076A9]/15">
                <span className="block h-full w-2/3 animate-pulse rounded-full bg-[#0076A9]" />
              </div>
            </div>
          ) : null}

          {stage === "success" ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#28a745] text-xl text-white">
                ✓
              </span>
              <h2
                id="digilocker-title"
                className="mt-4 text-xl font-bold text-ink"
              >
                {fetched.length} documents fetched
              </h2>
              <p className="mt-2 max-w-sm text-metadata text-muted">
                Your GST, Udyam, signatory, and address documents are ready to be
                verified by Udyam Digital.
              </p>
              <ul className="mt-4 w-full max-w-sm space-y-1 text-left">
                {fetched.map((document) => (
                  <li
                    key={document.key}
                    className="flex items-center justify-between gap-3 border border-ink/10 px-3 py-2 text-metadata"
                  >
                    <span className="truncate text-ink">{document.label}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wider text-[#28a745]">
                      Fetched
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleFinish}
                className="mt-5 w-full max-w-sm bg-[#0076A9] px-5 py-3 text-label font-strong uppercase tracking-wider text-white hover:bg-[#005b8f]"
              >
                Continue to Udyam Digital
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-ink/10 bg-[#f7f8fa] px-5 py-2 text-center text-[11px] text-muted">
          Sandbox environment · No real DigiLocker account is accessed
        </div>
      </div>
    </div>
  );
}

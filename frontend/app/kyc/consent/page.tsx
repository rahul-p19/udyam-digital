"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ApiError,
  kycApi,
  type KycDataCategory,
  type KycPurpose,
} from "@/lib/api";

const CONSENT_VERSION = "1.0";
const EFFECTIVE_DATE = "3 November 2026";
const GRIEVANCE_EMAIL = "privacy@udyamdigital.in";

const dataCategories: Array<{
  id: KycDataCategory;
  title: string;
  description: string;
}> = [
  {
    id: "gst_certificate",
    title: "GST certificate",
    description: "Your GSTIN and business registration details.",
  },
  {
    id: "udyam_certificate",
    title: "Udyam certificate",
    description: "Your Udyam registration number and enterprise details.",
  },
  {
    id: "signatory_id",
    title: "Signatory identity proof",
    description:
      "Aadhaar or PAN of the person authorised to sign for the business.",
  },
  {
    id: "address_proof",
    title: "Address proof",
    description:
      "A document confirming the registered or operating address of the business.",
  },
];

const purposes: Array<{
  id: KycPurpose;
  title: string;
  description: string;
}> = [
  {
    id: "identity_verification",
    title: "Identity verification",
    description:
      "To confirm that the business and its authorised signatory are genuine.",
  },
  {
    id: "regulatory_compliance",
    title: "Regulatory compliance",
    description:
      "To meet applicable KYC and anti-money-laundering obligations.",
  },
  {
    id: "fraud_prevention",
    title: "Fraud prevention",
    description:
      "To detect and prevent misuse, impersonation, and financial fraud.",
  },
];

const rights = [
  {
    title: "Access",
    description: "Ask for a copy of your KYC data and consent record.",
  },
  {
    title: "Correction",
    description: "Ask us to correct inaccurate or incomplete KYC data.",
  },
  {
    title: "Erasure",
    description:
      "Ask us to delete your data when no legal obligation requires us to keep it.",
  },
  {
    title: "Withdrawal",
    description: "Withdraw this consent at any time, free of charge.",
  },
  {
    title: "Grievance redressal",
    description: "Raise a complaint with our Data Protection Officer.",
  },
  {
    title: "Nomination",
    description:
      "Nominate another person to exercise your rights in case of death or incapacity.",
  },
];

export default function KycConsentPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [authorizedSignatory, setAuthorizedSignatory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!accepted || !authorizedSignatory) {
      setError(
        "Please read the notice and select both confirmations before continuing.",
      );
      return;
    }

    setPending(true);

    try {
      await kycApi.recordConsent({
        consentVersion: CONSENT_VERSION,
        dataCategories: dataCategories.map((item) => item.id),
        purposes: purposes.map((item) => item.id),
        accepted,
        authorizedSignatory,
      });
      router.push("/kyc/verify");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to record your consent. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-ground text-ink">
      <SiteHeader marker="Business KYC" />

      <main className="mx-auto max-w-5xl px-gutter py-10 sm:py-14">
        <nav
          aria-label="KYC progress"
          className="mb-8 flex items-center gap-3 text-label font-strong uppercase"
        >
          <span className="flex h-7 w-7 items-center justify-center border-2 border-accent bg-accent text-white">
            1
          </span>
          <span className="text-accent">Consent</span>
          <span className="h-0.5 flex-1 bg-ink/15" />
          <span className="flex h-7 w-7 items-center justify-center border-2 border-ink/20 text-muted">
            2
          </span>
          <span className="text-muted">Verify documents</span>
        </nav>

        <div className="border-b-2 border-ink pb-8">
          <p className="text-label font-strong uppercase text-accent">
            Digital Personal Data Protection Act, 2023
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-[750] leading-none tracking-tight text-ink sm:text-5xl">
            KYC consent for your business
          </h1>
          <p className="mt-5 max-w-2xl text-body text-muted">
            Before we verify your business, please review how Udyam Digital
            collects, uses, and shares your business KYC information. Your
            consent must be specific, informed, and given by a clear affirmative
            action.
          </p>
        </div>

        <div className="mt-8 border-l-2 border-accent bg-surface px-4 py-3 text-metadata text-ink">
          <strong className="font-strong text-accent">
            This is business KYC.
          </strong>{" "}
          This consent covers verification of your registered business only. It
          does not cover personal KYC for individual customers.
        </div>

        <div className="mt-6">
          <section className="border-t-2 border-ink py-6">
            <h2 className="text-item-title font-[750] tracking-tight text-ink">
              1. What we collect
            </h2>
            <p className="mt-1 text-metadata text-muted">
              We collect only the following KYC data for your business.
            </p>
            <ul className="mt-4 grid gap-px border-y border-ink/15 bg-ink/15 sm:grid-cols-2">
              {dataCategories.map((item) => (
                <li key={item.id} className="bg-ground p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-label font-strong text-accent">
                      ✓
                    </span>
                    <div>
                      <p className="text-metadata font-strong text-ink">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-metadata text-muted">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t-2 border-ink py-6">
            <h2 className="text-item-title font-[750] tracking-tight text-ink">
              2. Why we process it
            </h2>
            <ul className="mt-4 divide-y divide-ink/15 border-y border-ink/15">
              {purposes.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 text-label font-strong text-accent">
                    ✓
                  </span>
                  <div>
                    <p className="text-metadata font-strong text-ink">
                      {item.title}
                    </p>
                    <p className="text-metadata text-muted">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t-2 border-ink py-6">
            <h2 className="text-item-title font-[750] tracking-tight text-ink">
              3. How we handle it
            </h2>
            <dl className="mt-4 divide-y divide-ink/15 border-y border-ink/15 text-metadata">
              <div className="py-3">
                <dt className="font-strong text-ink">Who we share it with</dt>
                <dd className="mt-1 text-muted">
                  Udyam Digital, its authorised KYC verification partners, and
                  government portals such as the GST and Udyam registration
                  systems, only for the purposes listed above.
                </dd>
              </div>
              <div className="py-3">
                <dt className="font-strong text-ink">How long we keep it</dt>
                <dd className="mt-1 text-muted">
                  Only for as long as needed for the purposes above or as
                  required by law. When it is no longer needed, we delete or
                  anonymise it.
                </dd>
              </div>
              <div className="py-3">
                <dt className="font-strong text-ink">How you can withdraw</dt>
                <dd className="mt-1 text-muted">
                  Email{" "}
                  <a
                    href={`mailto:${GRIEVANCE_EMAIL}`}
                    className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
                  >
                    {GRIEVANCE_EMAIL}
                  </a>{" "}
                  at any time. Withdrawal does not affect processing already
                  carried out, and may mean we cannot complete or continue your
                  KYC verification.
                </dd>
              </div>
            </dl>
          </section>

          <section
            id="your-rights"
            className="border-t-2 border-ink py-6"
          >
            <h2 className="text-item-title font-[750] tracking-tight text-ink">
              4. Your rights as a Data Principal
            </h2>
            <div className="mt-4 grid gap-px border-y border-ink/15 bg-ink/15 sm:grid-cols-2">
              {rights.map((right) => (
                <div key={right.title} className="bg-ground px-3.5 py-3">
                  <p className="text-metadata font-strong text-ink">
                    {right.title}
                  </p>
                  <p className="mt-0.5 text-metadata text-muted">
                    {right.description}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-metadata text-muted">
              To exercise any of these rights, contact our Data Protection
              Officer at{" "}
              <a
                href={`mailto:${GRIEVANCE_EMAIL}`}
                className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
              >
                {GRIEVANCE_EMAIL}
              </a>
              . You may also complain to the Data Protection Board of India
              under the DPDP Act, 2023.
            </p>
          </section>
        </div>

        <form onSubmit={handleSubmit} className="mt-2">
          <div className="border-2 border-ink bg-surface p-5 sm:p-6">
            <h2 className="text-item-title font-[750] tracking-tight text-ink">
              Your consent
            </h2>

            {error ? (
              <p
                role="alert"
                className="mt-3 border-l-2 border-accent bg-ground px-3 py-2 text-metadata text-accent"
              >
                {error}
              </p>
            ) : null}

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <span className="text-metadata text-ink">
                I have read and understood this notice, and I consent to Udyam
                Digital processing the KYC data listed above for the stated
                purposes, including sharing it with the verification partners
                and government portals named in this notice.
              </span>
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={authorizedSignatory}
                onChange={(event) =>
                  setAuthorizedSignatory(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <span className="text-metadata text-ink">
                I confirm that I am 18 years or older, that I am authorised to
                act for this business, and that the documents I submit belong to
                the business.
              </span>
            </label>

            <div className="mt-5 flex flex-col gap-3 border-t border-ink/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-metadata text-muted">
                Consent version {CONSENT_VERSION} · Effective {EFFECTIVE_DATE}
              </p>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center justify-center border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Recording consent..." : "Give consent and continue"}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-5 text-center text-metadata text-muted">
          Changed your mind? You can{" "}
          <Link
            href="/dashboard"
            className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            return to your dashboard
          </Link>{" "}
          without giving consent.
        </p>
      </main>
    </div>
  );
}

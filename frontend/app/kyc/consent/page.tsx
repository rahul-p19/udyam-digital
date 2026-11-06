"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
    <div className="min-h-screen bg-white text-[#3E4146]">
      <header className="border-b border-[#E40000]/15 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E40000] text-lg font-black lowercase text-white">
              a
            </span>
            <span className="text-lg font-semibold tracking-tight text-[#E40000]">
              udyam digital
            </span>
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3E4146]/55">
            Business KYC
          </span>
        </div>
        <div className="h-1 bg-[#E40000]" />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <nav
          aria-label="KYC progress"
          className="mb-8 flex items-center gap-3 text-xs font-medium"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E40000] text-white">
            1
          </span>
          <span className="text-[#E40000]">Consent</span>
          <span className="h-px flex-1 bg-[#E40000]/20" />
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3E4146]/20 text-[#3E4146]/45">
            2
          </span>
          <span className="text-[#3E4146]/45">Verify documents</span>
        </nav>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E40000]">
            Digital Personal Data Protection Act, 2023
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#3E4146] sm:text-4xl">
            KYC consent for your business
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#3E4146]/75">
            Before we verify your business, please review how Udyam Digital
            collects, uses, and shares your business KYC information. Your
            consent must be specific, informed, and given by a clear affirmative
            action.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-[#E40000]/20 bg-[#FFF1F1] px-4 py-3 text-sm leading-6 text-[#3E4146]/80">
          <strong className="font-semibold text-[#E40000]">
            This is business KYC.
          </strong>{" "}
          This consent covers verification of your registered business only. It
          does not cover personal KYC for individual customers.
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-[#3E4146]/12 bg-white p-5 shadow-[0_1px_2px_rgba(62,65,70,0.04)] sm:p-6">
            <h2 className="text-base font-semibold text-[#3E4146]">
              1. What we collect
            </h2>
            <p className="mt-1 text-sm text-[#3E4146]/65">
              We collect only the following KYC data for your business.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {dataCategories.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-[#3E4146]/10 bg-[#FFFBFB] p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E40000]/10 text-[11px] font-bold text-[#E40000]">
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#3E4146]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[#3E4146]/60">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-[#3E4146]/12 bg-white p-5 shadow-[0_1px_2px_rgba(62,65,70,0.04)] sm:p-6">
            <h2 className="text-base font-semibold text-[#3E4146]">
              2. Why we process it
            </h2>
            <ul className="mt-4 space-y-3">
              {purposes.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E40000]/10 text-[11px] font-bold text-[#E40000]">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#3E4146]">
                      {item.title}
                    </p>
                    <p className="text-xs leading-5 text-[#3E4146]/60">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-[#3E4146]/12 bg-white p-5 shadow-[0_1px_2px_rgba(62,65,70,0.04)] sm:p-6">
            <h2 className="text-base font-semibold text-[#3E4146]">
              3. How we handle it
            </h2>
            <dl className="mt-4 space-y-4 text-sm leading-6">
              <div>
                <dt className="font-medium text-[#3E4146]">
                  Who we share it with
                </dt>
                <dd className="mt-0.5 text-[#3E4146]/65">
                  Udyam Digital, its authorised KYC verification partners, and
                  government portals such as the GST and Udyam registration
                  systems, only for the purposes listed above.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#3E4146]">How long we keep it</dt>
                <dd className="mt-0.5 text-[#3E4146]/65">
                  Only for as long as needed for the purposes above or as
                  required by law. When it is no longer needed, we delete or
                  anonymise it.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#3E4146]">
                  How you can withdraw
                </dt>
                <dd className="mt-0.5 text-[#3E4146]/65">
                  Email{" "}
                  <a
                    href={`mailto:${GRIEVANCE_EMAIL}`}
                    className="font-medium text-[#E40000] underline underline-offset-2"
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
            className="rounded-xl border border-[#3E4146]/12 bg-white p-5 shadow-[0_1px_2px_rgba(62,65,70,0.04)] sm:p-6"
          >
            <h2 className="text-base font-semibold text-[#3E4146]">
              4. Your rights as a Data Principal
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rights.map((right) => (
                <div
                  key={right.title}
                  className="rounded-lg bg-[#FFFBFB] px-3.5 py-3"
                >
                  <p className="text-sm font-medium text-[#3E4146]">
                    {right.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[#3E4146]/60">
                    {right.description}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#3E4146]/60">
              To exercise any of these rights, contact our Data Protection
              Officer at{" "}
              <a
                href={`mailto:${GRIEVANCE_EMAIL}`}
                className="font-medium text-[#E40000] underline underline-offset-2"
              >
                {GRIEVANCE_EMAIL}
              </a>
              . You may also complain to the Data Protection Board of India
              under the DPDP Act, 2023.
            </p>
          </section>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="rounded-xl border-2 border-[#E40000]/25 bg-[#FFFBFB] p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#3E4146]">
              Your consent
            </h2>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-[#E40000]/20 bg-[#FFF1F1] px-3 py-2 text-sm text-[#B30000]"
              >
                {error}
              </p>
            ) : null}

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#E40000]"
              />
              <span className="text-sm leading-6 text-[#3E4146]">
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
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#E40000]"
              />
              <span className="text-sm leading-6 text-[#3E4146]">
                I confirm that I am 18 years or older, that I am authorised to
                act for this business, and that the documents I submit belong to
                the business.
              </span>
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#3E4146]/55">
                Consent version {CONSENT_VERSION} · Effective {EFFECTIVE_DATE}
              </p>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-md bg-[#E40000] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C30000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E40000] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Recording consent..." : "Give consent and continue"}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-[#3E4146]/55">
          Changed your mind? You can{" "}
          <Link
            href="/dashboard"
            className="font-medium text-[#E40000] underline underline-offset-2"
          >
            return to your dashboard
          </Link>{" "}
          without giving consent.
        </p>
      </main>
    </div>
  );
}

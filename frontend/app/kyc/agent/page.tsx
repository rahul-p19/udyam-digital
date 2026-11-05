import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import VerificationDetails from "./verification-details";

export const metadata: Metadata = {
  title: "KYC agent support | Udyam Digital",
  description: "Get help completing your business KYC verification.",
};

export const instant = false;

export default async function KycAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const reference = Array.isArray(params.ref) ? params.ref[0] : params.ref;

  return (
    <div className="min-h-screen bg-ground text-ink">
      <SiteHeader marker="Business KYC" />

      <main className="mx-auto max-w-5xl px-gutter py-10 sm:py-14">
        <div className="border-t-2 border-ink pt-6">
          <span className="inline-block border-2 border-accent px-2 py-1 text-label font-strong uppercase text-accent">
            Manual review
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-[750] leading-none tracking-tight text-ink sm:text-5xl">
            An agent will help you finish KYC
          </h1>
          <p className="mt-4 max-w-2xl text-body text-muted">
            We could not automatically match one or more of your documents. An
            Udyam Digital agent will review the case and contact you with the
            next steps.
          </p>

          {reference ? (
            <>
              <div className="mt-6 border-l-2 border-accent bg-surface px-3 py-2">
                <p className="text-label font-strong uppercase text-muted">
                  Reference
                </p>
                <p className="mt-1 break-all text-metadata text-ink">
                  {reference}
                </p>
              </div>
              <VerificationDetails
                key={reference}
                verificationId={reference}
              />
            </>
          ) : null}

          <div className="mt-6 border-y border-ink/15 py-4">
            <p className="text-metadata font-strong text-ink">
              What happens next
            </p>
            <ol className="mt-3 divide-y divide-ink/15 text-metadata text-muted">
              <li className="py-2">1. An agent reviews the verification attempt.</li>
              <li className="py-2">2. You may be asked to re-upload a clearer document.</li>
              <li className="py-2">3. The agent completes the KYC review with you.</li>
            </ol>
          </div>

          <p className="mt-5 text-metadata text-muted">
            Agent assignment and contact details are not connected yet. This
            page is a placeholder for the manual review workflow.
          </p>

          <div className="mt-6 flex flex-col gap-3 border-t-2 border-ink pt-6 sm:flex-row">
            <Link
              href="/kyc/verify"
              className="inline-flex items-center justify-center border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
            >
              Try verification again
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center border-2 border-ink px-5 py-3 text-label font-strong uppercase text-ink hover:bg-ink hover:text-white"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

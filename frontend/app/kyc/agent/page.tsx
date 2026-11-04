import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="rounded-xl border border-[#E40000]/20 bg-white p-6 shadow-[0_1px_2px_rgba(62,65,70,0.04)] sm:p-8">
          <span className="inline-flex rounded-full bg-[#FFF1F1] px-3 py-1 text-xs font-semibold text-[#E40000]">
            Manual review
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#3E4146]">
            An agent will help you finish KYC
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#3E4146]/70">
            We could not automatically match one or more of your documents. An
            Udyam Digital agent will review the case and contact you with the
            next steps.
          </p>

          {reference ? (
            <>
              <div className="mt-5 rounded-lg border border-[#3E4146]/10 bg-[#FFFBFB] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3E4146]/50">
                  Reference
                </p>
                <p className="mt-1 break-all text-xs text-[#3E4146]/75">
                  {reference}
                </p>
              </div>
              <VerificationDetails
                key={reference}
                verificationId={reference}
              />
            </>
          ) : null}

          <div className="mt-6 rounded-lg border border-[#3E4146]/10 bg-[#FFFBFB] p-4">
            <p className="text-sm font-medium text-[#3E4146]">What happens next</p>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-[#3E4146]/65">
              <li>1. An agent reviews the verification attempt.</li>
              <li>2. You may be asked to re-upload a clearer document.</li>
              <li>3. The agent completes the KYC review with you.</li>
            </ol>
          </div>

          <p className="mt-5 text-xs leading-5 text-[#3E4146]/55">
            Agent assignment and contact details are not connected yet. This
            page is a placeholder for the manual review workflow.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/kyc/verify"
              className="inline-flex items-center justify-center rounded-md bg-[#E40000] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C30000]"
            >
              Try verification again
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-[#3E4146]/15 px-5 py-2.5 text-sm font-medium text-[#3E4146] transition-colors hover:bg-[#FFF1F1]"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

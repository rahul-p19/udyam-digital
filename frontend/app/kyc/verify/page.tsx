"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, kycApi, type KycVerification } from "@/lib/api";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const documents = [
  {
    key: "gstCertificate",
    title: "GST certificate",
    description: "A clear copy of your GST registration certificate.",
  },
  {
    key: "udyamCertificate",
    title: "Udyam certificate",
    description: "Your Udyam registration certificate.",
  },
  {
    key: "signatoryId",
    title: "Signatory ID",
    description:
      "PAN card or Aadhaar of the person authorised to sign for the business.",
  },
  {
    key: "addressProof",
    title: "Address proof",
    description:
      "A utility bill, rent agreement, or similar proof of the business address.",
  },
] as const;

type DocumentKey = (typeof documents)[number]["key"];
type SelectedFiles = Partial<Record<DocumentKey, File>>;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUploadCard({
  title,
  description,
  file,
  inputId,
  disabled,
  onSelect,
  onClear,
}: {
  title: string;
  description: string;
  file: File | undefined;
  inputId: string;
  disabled: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#3E4146]/12 bg-white p-4 shadow-[0_1px_2px_rgba(62,65,70,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#3E4146]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#3E4146]/60">
            {description}
          </p>
        </div>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            file
              ? "bg-[#E40000] text-white"
              : "bg-[#E40000]/10 text-[#E40000]"
          }`}
        >
          {file ? "✓" : "↑"}
        </span>
      </div>

      {file ? (
        <div className="mt-4 rounded-lg border border-[#E40000]/15 bg-[#FFFBFB] p-3">
          <p className="truncate text-xs font-medium text-[#3E4146]">
            {file.name}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#3E4146]/55">
              {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="text-[11px] font-semibold text-[#E40000] underline underline-offset-2 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#3E4146]/20 bg-[#FFFBFB] px-3 py-4 text-center text-xs font-medium text-[#3E4146]/65 transition-colors hover:border-[#E40000]/40 hover:bg-[#FFF1F1] ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          Choose JPG, PNG, or PDF
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";

          if (selected) {
            onSelect(selected);
          }
        }}
      />
    </div>
  );
}

export default function KycVerifyPage() {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedFiles>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verification, setVerification] = useState<KycVerification | null>(null);

  const selectedCount = documents.filter((document) => files[document.key]).length;
  const allSelected = selectedCount === documents.length;

  function selectFile(key: DocumentKey, file: File) {
    setError(null);

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, and PDF files are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Each file must be 8 MB or smaller.");
      return;
    }

    setFiles((current) => ({ ...current, [key]: file }));
  }

  function clearFile(key: DocumentKey) {
    setFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!allSelected) {
      setError("Please upload all four documents before continuing.");
      return;
    }

    const formData = new FormData();

    for (const document of documents) {
      const file = files[document.key];

      if (file) {
        formData.append(document.key, file, file.name);
      }
    }

    setPending(true);

    try {
      const response = await kycApi.verifyDocuments(formData);

      if (response.verification.status === "manual_review") {
        router.push(
          `/kyc/agent?ref=${encodeURIComponent(response.verification.id)}`,
        );
        return;
      }

      setVerification(response.verification);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }

      if (err instanceof ApiError && err.status === 403) {
        router.replace("/kyc/consent");
        return;
      }

      setError(
        err instanceof ApiError
          ? err.message
          : "We could not verify your documents. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (verification) {
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
          <div className="rounded-xl border border-[#1B7F4B]/20 bg-[#F0FFF6] p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B7F4B] text-lg font-bold text-white">
              ✓
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#3E4146]">
              Business KYC verified
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#3E4146]/70">
              Your documents matched the GST and Udyam registry records.
            </p>
            <p className="mt-4 break-all rounded-lg bg-white/70 px-3 py-2 text-xs text-[#3E4146]/60">
              Reference: {verification.id}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md bg-[#E40000] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C30000]"
              >
                Go to dashboard
              </Link>
              <Link
                href="/kyc/consent"
                className="inline-flex items-center justify-center rounded-md border border-[#3E4146]/15 bg-white px-5 py-2.5 text-sm font-medium text-[#3E4146] transition-colors hover:bg-[#FFF1F1]"
              >
                Review consent
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
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
            ✓
          </span>
          <span className="text-[#E40000]">Consent</span>
          <span className="h-px flex-1 bg-[#E40000]/20" />
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E40000] text-white">
            2
          </span>
          <span className="text-[#E40000]">Verify documents</span>
        </nav>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E40000]">
            Step 2 of 2
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#3E4146] sm:text-4xl">
            Verify your business documents
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#3E4146]/75">
            Upload all four documents. We extract the required details, compare
            them with the GST and Udyam registries, and discard the uploaded
            files after processing.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-[#E40000]/20 bg-[#FFF1F1] px-4 py-3 text-xs leading-5 text-[#3E4146]/75">
          Use clear, full-page photos or scans. Blurred, cropped, or password
          protected files cannot be verified.
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-md border border-[#E40000]/20 bg-[#FFF1F1] px-3 py-2 text-sm text-[#B30000]"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <fieldset disabled={pending}>
            <legend className="sr-only">KYC documents</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {documents.map((document) => (
                <FileUploadCard
                  key={document.key}
                  inputId={`kyc-${document.key}`}
                  title={document.title}
                  description={document.description}
                  file={files[document.key]}
                  disabled={pending}
                  onSelect={(file) => selectFile(document.key, file)}
                  onClear={() => clearFile(document.key)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-6 rounded-xl border border-[#3E4146]/12 bg-[#FFFBFB] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#3E4146]">
                  {selectedCount} of {documents.length} documents selected
                </p>
                <p className="mt-1 text-xs leading-5 text-[#3E4146]/55">
                  JPG, PNG, or PDF up to 8 MB each. Files are processed in
                  memory and are not retained.
                </p>
              </div>
              <button
                type="submit"
                disabled={pending || !allSelected}
                className="inline-flex items-center justify-center rounded-md bg-[#E40000] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C30000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E40000] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Verifying documents..." : "Verify documents"}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-[#3E4146]/55">
          Having trouble?{" "}
          <Link
            href="/kyc/agent"
            className="font-medium text-[#E40000] underline underline-offset-2"
          >
            Get help from an agent
          </Link>
        </p>
      </main>
    </div>
  );
}

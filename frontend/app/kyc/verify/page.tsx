"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
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
    <div className="flex h-full flex-col border border-ink/20 bg-ground p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-metadata font-strong text-ink">{title}</p>
          <p className="mt-1 text-metadata text-muted">{description}</p>
        </div>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 text-label font-strong ${
            file
              ? "border-accent bg-accent text-white"
              : "border-ink/20 text-accent"
          }`}
        >
          {file ? "✓" : "↑"}
        </span>
      </div>

      {file ? (
        <div className="mt-4 border-l-2 border-accent bg-surface p-3">
          <p className="truncate text-metadata font-strong text-ink">
            {file.name}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-label font-strong uppercase text-muted">
              {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="text-label font-strong uppercase text-accent underline underline-offset-4 hover:text-accent-hover disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`mt-4 flex cursor-pointer items-center justify-center border-2 border-dashed border-ink/25 bg-surface px-3 py-4 text-center text-label font-strong uppercase text-ink hover:border-accent hover:text-accent ${
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
      <div className="min-h-screen bg-ground text-ink">
        <SiteHeader marker="Business KYC" />

        <main className="mx-auto max-w-3xl px-gutter py-10 sm:py-14">
          <div className="border-2 border-ink bg-ink p-6 text-white sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-accent bg-accent text-label font-strong text-white">
              ✓
            </span>
            <h1 className="mt-4 text-4xl font-[750] leading-none tracking-tight text-white">
              Business KYC verified
            </h1>
            <p className="mt-3 max-w-xl text-body text-white/75">
              Your documents matched the GST and Udyam registry records.
            </p>
            <p className="mt-4 break-all border border-white/25 px-3 py-2 text-metadata text-white/80">
              Reference: {verification.id}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
              >
                Go to dashboard
              </Link>
              <Link
                href="/kyc/consent"
                className="inline-flex items-center justify-center border-2 border-white px-5 py-3 text-label font-strong uppercase text-white hover:bg-white hover:text-ink"
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
    <div className="min-h-screen bg-ground text-ink">
      <SiteHeader marker="Business KYC" />

      <main className="mx-auto max-w-5xl px-gutter py-10 sm:py-14">
        <nav
          aria-label="KYC progress"
          className="mb-8 flex items-center gap-3 text-label font-strong uppercase"
        >
          <span className="flex h-7 w-7 items-center justify-center border-2 border-accent bg-accent text-white">
            ✓
          </span>
          <span className="text-accent">Consent</span>
          <span className="h-0.5 flex-1 bg-accent" />
          <span className="flex h-7 w-7 items-center justify-center border-2 border-accent bg-accent text-white">
            2
          </span>
          <span className="text-accent">Verify documents</span>
        </nav>

        <div className="border-b-2 border-ink pb-8">
          <p className="text-label font-strong uppercase text-accent">
            Step 2 of 2
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-[750] leading-none tracking-tight text-ink sm:text-5xl">
            Verify your business documents
          </h1>
          <p className="mt-5 max-w-2xl text-body text-muted">
            Upload all four documents. We extract the required details, compare
            them with the GST and Udyam registries, and discard the uploaded
            files after processing.
          </p>
        </div>

        <div className="mt-8 border-l-2 border-accent bg-surface px-4 py-3 text-metadata text-ink">
          Use clear, full-page photos or scans. Blurred, cropped, or password
          protected files cannot be verified.
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-6 border-l-2 border-accent bg-surface px-3 py-2 text-metadata text-accent"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6">
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

          <div className="mt-6 border-2 border-ink bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-metadata font-strong text-ink">
                  {selectedCount} of {documents.length} documents selected
                </p>
                <p className="mt-1 text-metadata text-muted">
                  JPG, PNG, or PDF up to 8 MB each. Files are processed in
                  memory and are not retained.
                </p>
              </div>
              <button
                type="submit"
                disabled={pending || !allSelected}
                className="inline-flex items-center justify-center border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Verifying documents..." : "Verify documents"}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-5 text-center text-metadata text-muted">
          Having trouble?{" "}
          <Link
            href="/kyc/agent"
            className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            Get help from an agent
          </Link>
        </p>
      </main>
    </div>
  );
}

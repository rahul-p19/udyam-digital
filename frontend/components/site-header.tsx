import Link from "next/link";

export function SiteHeader({ marker }: { marker: string }) {
  return (
    <header className="border-b-2 border-ink">
      <div className="flex items-center justify-between gap-4 px-gutter py-4">
        <Link href="/" className="text-label font-strong uppercase text-ink">
          Udyam Digital
        </Link>
        <span className="text-label font-strong uppercase text-muted">
          {marker}
        </span>
      </div>
    </header>
  );
}

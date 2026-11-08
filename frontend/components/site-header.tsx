import Link from "next/link";
import { getWhatsAppAdvisorUrl } from "@/lib/whatsapp";

export function SiteHeader({ marker }: { marker: string }) {
  const whatsappUrl = getWhatsAppAdvisorUrl();

  return (
    <header className="border-b-2 border-ink">
      <div className="flex items-center justify-between gap-4 px-gutter py-4">
        <Link href="/" className="text-label font-strong uppercase text-ink">
          Udyam Digital
        </Link>
        <div className="flex items-center gap-4">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="text-label font-strong uppercase text-accent hover:text-accent-hover"
            >
              Chat on WhatsApp
            </a>
          ) : null}
          <span className="text-label font-strong uppercase text-muted">
            {marker}
          </span>
        </div>
      </div>
    </header>
  );
}

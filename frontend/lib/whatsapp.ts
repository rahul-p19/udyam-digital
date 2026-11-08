const DEFAULT_MESSAGE =
  "Hi, I'd like to speak with the Udyam AI Advisor about digital services for my business.";

export function getWhatsAppAdvisorUrl(message: string = DEFAULT_MESSAGE): string | null {
  const digits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!digits) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

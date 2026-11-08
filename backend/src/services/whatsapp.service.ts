import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export type WhatsAppStatus = "sent" | "skipped" | "failed";

export interface WhatsAppResult {
  status: WhatsAppStatus;
  messageId: string | null;
  error: string | null;
}

export interface OrderConfirmationInput {
  orderId: string;
  contactName: string;
  contactPhone: string;
  totalMonthlyMin: number;
  totalMonthlyMax: number;
  estimatedActivationDate: string | null;
}

type TwilioApiResponse = {
  sid?: string;
  status?: string;
  code?: number;
  message?: string;
  error_message?: string;
};

const skipped = (error: string): WhatsAppResult => ({
  status: "skipped",
  messageId: null,
  error,
});

export function normalizeWhatsAppNumber(
  raw: string,
  defaultCountryCode: string = env.whatsapp.defaultCountryCode,
): string {
  const trimmed = raw.trim().replace(/^whatsapp:/i, "");
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return digits;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  return digits;
}

function toWhatsAppAddress(raw: string): string {
  const digits = normalizeWhatsAppNumber(raw);
  return digits ? `whatsapp:+${digits}` : "";
}

function formatFromAddress(raw: string): string {
  if (raw.startsWith("whatsapp:")) {
    const digits = raw.slice("whatsapp:".length).replace(/\D/g, "");
    return digits ? `whatsapp:+${digits}` : raw;
  }
  const digits = raw.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : raw;
}

function orderReference(orderId: string): string {
  return `#${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthlyTotal(input: OrderConfirmationInput): string {
  const min = formatCurrency(input.totalMonthlyMin);
  if (input.totalMonthlyMin === input.totalMonthlyMax) {
    return `${min}/month`;
  }
  return `${min}–${formatCurrency(input.totalMonthlyMax)}/month`;
}

function formatActivationDate(value: string | null): string {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function buildOrderConfirmationText(input: OrderConfirmationInput): string {
  return [
    `Hi ${input.contactName},`,
    "",
    `Your Udyam Digital order ${orderReference(input.orderId)} is confirmed!`,
    `Bundle: ${formatMonthlyTotal(input)}`,
    `Estimated activation: ${formatActivationDate(input.estimatedActivationDate)}`,
    "",
    "Our team will call you shortly to confirm installation timing.",
    "Reply here to chat with our Udyam AI Advisor on WhatsApp.",
  ].join("\n");
}

function buildContentVariables(input: OrderConfirmationInput): string {
  return JSON.stringify({
    "1": input.contactName,
    "2": orderReference(input.orderId),
    "3": formatMonthlyTotal(input),
    "4": formatActivationDate(input.estimatedActivationDate),
  });
}

async function postToTwilio(
  params: Record<string, string>,
  context: string,
): Promise<WhatsAppResult> {
  const {
    enabled,
    accountSid,
    authToken,
    from,
    messagingServiceSid,
    apiBaseUrl,
    timeoutMs,
    contentSid
  } = env.whatsapp;

  if (!enabled) {
    return skipped("WhatsApp notifications are disabled");
  }
  if (!accountSid || !authToken) {
    return skipped("Twilio account SID or auth token is not configured");
  }
  if (!from && !messagingServiceSid) {
    return skipped("Twilio WhatsApp sender is not configured");
  }

  const body = new URLSearchParams(params);
  if (from) {
    body.set("From", formatFromAddress(from));
  } else if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  }

  if(contentSid)
    body.set("ContentSid", contentSid);

  const to = params.To ?? "unknown recipient";

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64",
    );
    const response = await fetch(
      `${apiBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body,
      },
    );

    const payload = (await response.json().catch(() => null)) as TwilioApiResponse | null;

    if (!response.ok) {
      const message =
        payload?.error_message ??
        payload?.message ??
        `Twilio API request failed with status ${response.status}`;
      console.error(`${context} failed: ${message}`);
      return { status: "failed", messageId: null, error: message };
    }

    const messageId = payload?.sid ?? null;
    console.log(`${context} sent to ${to} (message ${messageId ?? "unknown"})`);
    return { status: "sent", messageId, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Twilio error";
    console.error(`${context} failed: ${message}`);
    return { status: "failed", messageId: null, error: message };
  }
}

export async function sendOrderConfirmation(
  input: OrderConfirmationInput,
): Promise<WhatsAppResult> {
  const to = toWhatsAppAddress(input.contactPhone);
  if (!to) {
    return { status: "failed", messageId: null, error: "Invalid recipient phone number" };
  }

  const params: Record<string, string> = { To: to };

  if (env.whatsapp.messageType === "template") {
    if (!env.whatsapp.contentSid) {
      return skipped("TWILIO_CONTENT_SID is not configured for template messages");
    }
    params.ContentSid = env.whatsapp.contentSid;
    params.ContentVariables = buildContentVariables(input);
  } else {
    params.Body = buildOrderConfirmationText(input);
  }

  return postToTwilio(
    params,
    `WhatsApp order confirmation (order ${input.orderId})`,
  );
}

export async function sendWhatsAppText(
  toRaw: string,
  text: string,
): Promise<WhatsAppResult> {
  const to = toWhatsAppAddress(toRaw);
  if (!to) {
    return { status: "failed", messageId: null, error: "Invalid recipient phone number" };
  }

  const bodyText =
    text.length > 4096 ? `${text.slice(0, 4093).trimEnd()}...` : text;

  return postToTwilio({ To: to, Body: bodyText }, "WhatsApp bot reply");
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  const authToken = env.whatsapp.authToken;
  if (!authToken) {
    if (env.isProduction) {
      console.error(
        "TWILIO_AUTH_TOKEN is not set; rejecting webhook in production",
      );
      return false;
    }
    return true;
  }

  if (!signature) return false;

  const payload = Object.keys(params)
    .sort()
    .reduce((accumulator, key) => accumulator + key + params[key], url);

  const expected = Buffer.from(
    createHmac("sha1", authToken).update(Buffer.from(payload, "utf8")).digest("base64"),
    "utf8",
  );
  const received = Buffer.from(signature, "utf8");

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

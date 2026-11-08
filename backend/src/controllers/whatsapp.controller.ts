import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { verifyTwilioSignature } from "../services/whatsapp.service.js";
import { queueIncomingWhatsAppMessage } from "../services/whatsapp-bot.service.js";

const processedMessageIds = new Set<string>();
const MAX_TRACKED_MESSAGES = 1000;

function isDuplicate(messageId: string): boolean {
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > MAX_TRACKED_MESSAGES) {
    const oldest = processedMessageIds.values().next().value;
    if (oldest) processedMessageIds.delete(oldest);
  }
  return false;
}

function requestUrl(req: Request): string {
  if (env.whatsapp.webhookUrl) return env.whatsapp.webhookUrl;

  const proto = (req.header("x-forwarded-proto") ?? req.protocol)
    .split(",")[0]
    .trim();
  const host = (
    req.header("x-forwarded-host") ??
    req.header("host") ??
    "localhost"
  )
    .split(",")[0]
    .trim();

  return `${proto}://${host}${req.originalUrl}`;
}

function bodyToParams(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null) return {};

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === "string") {
      params[key] = value;
    } else if (Array.isArray(value)) {
      params[key] = value.map(String).join("");
    } else if (value !== undefined && value !== null) {
      params[key] = String(value);
    }
  }
  return params;
}

export function receiveWebhook(req: Request, res: Response): void {
  const signature = req.header("x-twilio-signature") ?? undefined;
  const params = bodyToParams(req.body);

  if (!verifyTwilioSignature(requestUrl(req), params, signature)) {
    res.status(403).json({ error: { message: "Invalid Twilio signature" } });
    return;
  }

  // Acknowledge immediately; replies are sent asynchronously through the
  // Twilio REST API by the advisor bot.
  res.status(200).type("text/xml").send("<Response></Response>");

  const from = params.From ?? "";
  if (!from.startsWith("whatsapp:")) return;

  const text = (params.Body ?? params.ButtonText ?? "").trim();
  if (!text) return;

  const messageId = params.MessageSid ?? params.SmsMessageSid;
  if (messageId && isDuplicate(messageId)) return;

  queueIncomingWhatsAppMessage(from, text);
}

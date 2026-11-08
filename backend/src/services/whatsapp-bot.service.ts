import { query } from "../db/pool.js";
import { createAdvisorSession, getAdvisorSession } from "./advisor.service.js";
import {
  processAdvisorMessage,
  startAdvisorSession,
} from "./advisor.orchestrator.js";
import { computeRecommendations } from "./recommendations.service.js";
import { normalizeWhatsAppNumber, sendWhatsAppText } from "./whatsapp.service.js";
import type { AdvisorSession } from "../types/advisor.js";

const GREETING_PATTERN = /^(hi+|hello+|hey+|start|namaste|good (morning|afternoon|evening))\b/i;
const RESET_PATTERN = /^(restart|reset|start over|new conversation)\b/i;

const COMPLETED_MESSAGE =
  "You've already completed your business profile. Reply RESTART to start a new conversation.";

const FALLBACK_ERROR =
  "Sorry, something went wrong on our side. Please try again in a moment.";

type SessionRow = { session_id: string };

async function findSessionByPhone(phone: string): Promise<AdvisorSession | null> {
  const result = await query<SessionRow>(
    "SELECT session_id FROM whatsapp_sessions WHERE phone_number = $1",
    [phone],
  );
  if (!result.rows[0]) return null;

  return getAdvisorSession(result.rows[0].session_id);
}

async function savePhoneSession(phone: string, sessionId: string): Promise<void> {
  await query(
    `INSERT INTO whatsapp_sessions (phone_number, session_id)
     VALUES ($1, $2)
     ON CONFLICT (phone_number)
     DO UPDATE SET session_id = EXCLUDED.session_id, updated_at = now()`,
    [phone, sessionId],
  );
}

async function createNewSession(phone: string): Promise<AdvisorSession> {
  const session = await startAdvisorSession(await createAdvisorSession());
  await savePhoneSession(phone, session.sessionId);
  return session;
}

async function getOrCreateSession(
  phone: string,
): Promise<{ session: AdvisorSession; isNew: boolean }> {
  const existing = await findSessionByPhone(phone);
  if (existing) {
    return { session: existing, isNew: false };
  }
  return { session: await createNewSession(phone), isNew: true };
}

function greetingMessage(session: AdvisorSession): string {
  return (
    session.messages[0]?.content ??
    "Hello! I'm your Udyam AI Advisor. To begin, what type of business do you operate?"
  );
}

function formatRecommendations(session: AdvisorSession): string {
  const conversationText = session.messages.map((m) => m.content).join(" ");
  const recommendations = computeRecommendations(
    session.profile,
    conversationText,
    false,
    3,
  );

  if (recommendations.length === 0) return "";

  return recommendations
    .map((product, index) => {
      const min = product.monthlyPrice.min.toLocaleString("en-IN");
      const max = product.monthlyPrice.max.toLocaleString("en-IN");
      const price = min === max ? `₹${min}/month` : `₹${min}–₹${max}/month`;
      return `${index + 1}. ${product.name} — ${price}`;
    })
    .join("\n");
}

async function handleIncomingWhatsAppMessage(
  from: string,
  text: string,
): Promise<void> {
  const phone = normalizeWhatsAppNumber(from);
  const message = text.trim().slice(0, 2000);
  if (!phone || !message) return;

  try {
    if (RESET_PATTERN.test(message)) {
      const session = await createNewSession(phone);
      await sendWhatsAppText(phone, greetingMessage(session));
      return;
    }

    const { session, isNew } = await getOrCreateSession(phone);

    if (isNew && GREETING_PATTERN.test(message)) {
      await sendWhatsAppText(phone, greetingMessage(session));
      return;
    }

    if (session.status === "complete") {
      await sendWhatsAppText(phone, COMPLETED_MESSAGE);
      return;
    }

    const result = await processAdvisorMessage(session, message);

    let reply = result.assistantMessage;
    if (result.session.profile.profileComplete) {
      const recommendationText = formatRecommendations(result.session);
      if (recommendationText) {
        reply += `\n\nTop recommendations for your business:\n${recommendationText}`;
      }
      reply += "\n\nReply RESTART to start a new conversation.";
    }

    await sendWhatsAppText(phone, reply);
  } catch (error) {
    console.error("WhatsApp bot failed to handle an incoming message", error);
    await sendWhatsAppText(phone, FALLBACK_ERROR).catch(() => undefined);
  }
}

const messageQueues = new Map<string, Promise<void>>();

export function queueIncomingWhatsAppMessage(from: string, text: string): void {
  const previous = messageQueues.get(from) ?? Promise.resolve();
  const next = previous.then(() =>
    handleIncomingWhatsAppMessage(from, text),
  );
  messageQueues.set(from, next);

  void next.finally(() => {
    if (messageQueues.get(from) === next) {
      messageQueues.delete(from);
    }
  });
}

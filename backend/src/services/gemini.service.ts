import type { AdvisorMessage, BusinessProfile } from "../types/advisor.js";
import { env } from "../config/env.js";

type GeminiExtraction = Partial<BusinessProfile>;

const systemInstruction = `You are a business requirements extraction assistant for Udyam Digital.
Extract only facts explicitly present in the user's latest message. Do not invent or overwrite existing values.
Return JSON only with these optional keys: businessType, employeeCount, locationCount,
currentInfrastructure (string array), requirements (string array), monthlyBudget
({min,max,currency:"INR"}), preferredLanguage. Use null for unknown scalar values.
employeeCount and locationCount must be positive integers. A flexible or undecided budget may be
represented as {min:null,max:null,currency:"INR"} only when explicitly stated.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateExtraction(value: unknown): GeminiExtraction {
  if (!isRecord(value)) return {};
  const result: GeminiExtraction = {};
  if (typeof value.businessType === "string" && value.businessType.trim()) {
    result.businessType = value.businessType.trim();
  }
  if (
    typeof value.employeeCount === "number" &&
    Number.isInteger(value.employeeCount) &&
    value.employeeCount > 0
  ) {
    result.employeeCount = value.employeeCount;
  }
  if (
    typeof value.locationCount === "number" &&
    Number.isInteger(value.locationCount) &&
    value.locationCount > 0
  ) {
    result.locationCount = value.locationCount;
  }
  for (const field of ["currentInfrastructure", "requirements"] as const) {
    if (
      Array.isArray(value[field]) &&
      value[field].every((item) => typeof item === "string")
    ) {
      result[field] = value[field].map((item) => item.trim()).filter(Boolean);
    }
  }
  if (isRecord(value.monthlyBudget)) {
    const min = value.monthlyBudget.min;
    const max = value.monthlyBudget.max;
    if (
      (min === null || (typeof min === "number" && min >= 0)) &&
      (max === null || (typeof max === "number" && max >= 0)) &&
      (min !== null || max !== null || value.monthlyBudget.currency === "INR")
    ) {
      result.monthlyBudget = {
        min: min as number | null,
        max: max as number | null,
        currency: "INR",
        isFlexible: value.monthlyBudget.isFlexible === true,
      };
    }
  }
  if (
    typeof value.preferredLanguage === "string" &&
    value.preferredLanguage.trim()
  ) {
    result.preferredLanguage = value.preferredLanguage.trim();
  }
  return result;
}

const FIELD_LABELS: Record<string, string> = {
  businessType: "type of business",
  employeeCount: "number of employees",
  locationCount: "number of locations or branches",
  currentInfrastructure: "current internet or connectivity setup",
  requirements: "required digital services",
  monthlyBudget: "approximate monthly budget in INR",
};

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  Hindi: "हिंदी में जवाब दें (Respond in Hindi). Use Devanagari script.",
  Hinglish: "Respond in Hinglish — a natural mix of Hindi and English commonly used by Indian business owners.",
  Tamil: "Respond in Tamil script.",
  Telugu: "Respond in Telugu script.",
  Kannada: "Respond in Kannada script.",
  Bengali: "Respond in Bengali script.",
  Marathi: "Respond in Marathi (Devanagari script).",
  Gujarati: "Respond in Gujarati script.",
  Punjabi: "Respond in Punjabi (Gurmukhi script).",
  Malayalam: "Respond in Malayalam script.",
};

function buildResponseSystemInstruction(
  profile: BusinessProfile,
  missingFieldsList: string[],
  profileComplete: boolean,
): string {
  const nextFieldsText = missingFieldsList
    .map((f) => FIELD_LABELS[f] ?? f)
    .join(", ");
  const completionInstruction = profileComplete
    ? "The business profile is now complete. Write a warm 2-sentence summary of their profile and tell them you are ready to show product recommendations."
    : `The next missing fields in order are: ${nextFieldsText}. Ask about the FIRST one only.`;

  const language = profile.preferredLanguage ?? "English";
  const languageRule = LANGUAGE_INSTRUCTION[language]
    ? `7. LANGUAGE: ${LANGUAGE_INSTRUCTION[language]}`
    : "7. Keep responses under 80 words. Use simple, warm English suitable for Indian business owners.";

  return `You are Udyam AI Advisor, a friendly and professional business connectivity consultant for Udyam Digital — an Airtel platform for Indian MSMEs.

Your goal is to help small business owners find the right telecom and digital services by collecting their requirements through natural conversation.

AVAILABLE SERVICES CATALOGUE (use this when asking about requirements):
Business broadband, Business SIM cards, WhatsApp/SMS communication, Cloud email, Cloud storage, Cybersecurity, CCTV connectivity, POS connectivity, Dedicated bandwidth, IoT connectivity.

RULES:
1. Acknowledge what the user just told you in one brief phrase, then ask exactly ONE question about the next missing field.
2. Never ask about information already captured in the profile below.
3. ${completionInstruction}
4. When asking about "requirements" (services needed), always list the available services so the user can choose. Example: "We offer: business broadband, SIM cards, WhatsApp/SMS, cloud email, cloud storage, cybersecurity, CCTV, POS, dedicated bandwidth, and IoT. Which of these would help your business?"
5. If the user asks something unrelated, acknowledge briefly and redirect back: "I will keep that in mind. For now, let me make sure I have all your business details."
6. If an answer is ambiguous, ask a brief clarification instead of assuming.
${languageRule}
8. Never invent or assume any facts about the user's business.
9. Do not ask multiple questions at once.

CURRENT BUSINESS PROFILE:
${JSON.stringify(profile, null, 2)}`;
}

export async function generateAdvisorResponse(
  profile: BusinessProfile,
  recentMessages: AdvisorMessage[],
  latestUserMessage: string,
  missingFieldsList: string[],
  profileComplete: boolean,
): Promise<string | null> {
  if (!env.geminiApiKey) return null;

  const history = recentMessages.slice(-6);
  const firstUserIdx = history.findIndex((m) => m.role === "user");
  const trimmedHistory = firstUserIdx >= 0 ? history.slice(firstUserIdx) : [];

  const contents = [
    ...trimmedHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user" as const, parts: [{ text: latestUserMessage }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(env.geminiTimeoutMs),
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: buildResponseSystemInstruction(
                profile,
                missingFieldsList,
                profileComplete,
              ),
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 150,
        },
      }),
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
}

export async function generateBundleExplanation(
  profile: BusinessProfile,
  products: Array<{ name: string; monthlyPrice: { min: number; max: number } }>,
): Promise<string | null> {
  if (!env.geminiApiKey || products.length === 0) return null;

  const budgetText = profile.monthlyBudget.isFlexible
    ? "flexible"
    : `₹${profile.monthlyBudget.min ?? 0}–₹${profile.monthlyBudget.max ?? "open"}/month`;

  const productList = products
    .slice(0, 3)
    .map((p) => `${p.name} (₹${p.monthlyPrice.min.toLocaleString("en-IN")}–₹${p.monthlyPrice.max.toLocaleString("en-IN")}/mo)`)
    .join(", ");

  const prompt = `You are Udyam AI Advisor for Accel Business. A small business owner just completed their needs assessment.

Business: ${profile.businessType ?? "small business"}, ${profile.employeeCount ?? 1} employees, ${profile.locationCount ?? 1} location(s)
Needs: ${profile.requirements.join(", ") || "general digital services"}
Budget: ${budgetText}
Current connectivity: ${profile.currentInfrastructure.join(", ") || "none"}
Top recommended products: ${productList}

Write a 2-3 sentence explanation of why these products are the right fit for this specific business. Be warm, specific, and use plain language. Mention their business type. No bullet points or headers.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(env.geminiTimeoutMs),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 180 },
      }),
    },
  );

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

export async function extractWithGemini(
  profile: BusinessProfile,
  message: string,
): Promise<GeminiExtraction> {
  if (!env.geminiApiKey) return {};
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(env.geminiTimeoutMs),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({ existingProfile: profile, latestMessage: message }),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );
  if (!response.ok) {
    const details = (await response.text()).trim();
    throw new Error(
      `Gemini request failed with status ${response.status}${
        details ? `: ${details}` : ""
      }`,
    );
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no structured content");
  return validateExtraction(JSON.parse(text));
}

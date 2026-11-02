import type { BusinessProfile } from "../types/advisor.js";
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

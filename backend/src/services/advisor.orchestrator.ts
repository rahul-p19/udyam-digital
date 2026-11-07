import {
  getAdvisorSession,
  missingFields,
  saveAdvisorSession,
} from "./advisor.service.js";
import {
  extractWithGemini,
  generateAdvisorResponse,
  validateExtraction,
} from "./gemini.service.js";
import type {
  AdvisorMessage,
  AdvisorSession,
  BusinessProfile,
} from "../types/advisor.js";

const questions: Record<string, string> = {
  businessType: "What type of business do you operate?",
  employeeCount:
    "How many people work at your business, including yourself?",
  locationCount: "How many branches or business locations do you operate?",
  currentInfrastructure: "What connectivity do you currently use?",
  requirements:
    "What services are you looking for? We offer: business broadband, business SIM cards, WhatsApp/SMS communication, cloud email, cloud storage, cybersecurity, CCTV connectivity, POS connectivity, dedicated bandwidth, and IoT connectivity. You can pick one or more, or describe what you need.",
  monthlyBudget:
    "What is your approximate monthly budget for these services in INR?",
};

function parseNumber(message: string, expression: RegExp): number | null {
  const match = message.match(expression);
  if (!match) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const value = words[match[1].toLowerCase()] ?? Number(match[1].replace(/,/g, ""));
  return Number.isInteger(value) && value > 0 ? value : null;
}

const CORRECTION_PATTERN =
  /\b(actually|no[,.]?\s*i\s+meant|change\s+that\s+to|correction[,:]|i\s+meant|wait[,.]?\s*just|just|only)\b/i;

function isCorrectionIntent(message: string): boolean {
  return CORRECTION_PATTERN.test(message.slice(0, 60));
}

function heuristicExtraction(message: string): Partial<BusinessProfile> {
  const lower = message.toLowerCase();
  const result: Partial<BusinessProfile> = {};
  const employees =
    parseNumber(
      message,
      /(?:^|\b)(?:with|have|including myself|employees?|people|staff)\D{0,15}(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)/i,
    ) ??
    parseNumber(
      message,
      /\b(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:employees?|people|staff|workers?)\b/i,
    );
  const locations =
    parseNumber(
      message,
      /(?:^|\b)(?:have|operate|run|manage)\D{0,15}(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:branches?|locations?|stores?)/i,
    ) ??
    parseNumber(
      message,
      /\b(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:branches?|locations?|stores?)\b/i,
    );
  if (employees !== null) result.employeeCount = employees;
  if (locations !== null) result.locationCount = locations;

  const businessPatterns = [
    /(?:own|run|operate|manage|have|working at|i\s+am\s+(?:in|a|an)|i'?m\s+(?:in|a|an|running))\s+(?:a|an|the)?\s*([^,.]{3,60})(?:\s+with\s+\d|\s*,|\s+and\s+|\s*$)/i,
    /it'?s?\s+(?:a|an)\s+([^,.]{3,60})/i,
    /^(?:a|an)\s+([^,.]{3,60})\s*$/i,
  ];
  for (const pattern of businessPatterns) {
    const m = lower.match(pattern);
    if (m?.[1]) {
      result.businessType = m[1].trim();
      break;
    }
  }

  const infrastructure: string[] = [];
  if (lower.includes("no internet")) infrastructure.push("no_internet");
  if (lower.includes("mobile data")) infrastructure.push("mobile_data");
  if (lower.includes("home broadband")) infrastructure.push("home_broadband");
  if (lower.includes("business broadband")) infrastructure.push("business_broadband");
  if (lower.includes("leased line")) infrastructure.push("leased_line");
  if (lower.includes("multiple internet")) infrastructure.push("multiple_connections");
  if (infrastructure.length) result.currentInfrastructure = infrastructure;

  const requirements = [
    ["broadband", "business broadband"],
    ["business_sim", "business sim"],
    ["whatsapp", "whatsapp"],
    ["sms", "sms"],
    ["cloud_email", "cloud email"],
    ["cloud_storage", "cloud storage"],
    ["cybersecurity", "cybersecurity"],
    ["cctv", "cctv"],
    ["pos", "pos"],
    ["dedicated_bandwidth", "dedicated bandwidth"],
    ["iot", "iot"],
  ]
    .filter(([, phrase]) => lower.includes(phrase))
    .map(([value]) => value);
  if (requirements.length) result.requirements = requirements;

  if (lower.includes("flexible") || lower.includes("no fixed budget")) {
    result.monthlyBudget = {
      min: null,
      max: null,
      currency: "INR",
      isFlexible: true,
    };
  } else {
    const amounts = [...message.matchAll(/₹?\s?(\d[\d,]*)/g)].map((match) =>
      Number(match[1].replace(/,/g, "")),
    );
    if (amounts.length) {
      result.monthlyBudget = {
        min: Math.min(...amounts),
        max: Math.max(...amounts),
        currency: "INR",
      };
    }
  }
  return result;
}

function mergeProfile(
  profile: BusinessProfile,
  updates: Partial<BusinessProfile>,
  correction = false,
): BusinessProfile {
  const next = { ...profile };
  for (const field of [
    "businessType",
    "employeeCount",
    "locationCount",
    "preferredLanguage",
  ] as const) {
    if (updates[field] !== undefined && updates[field] !== null) {
      next[field] = updates[field] as never;
    }
  }
  for (const field of ["currentInfrastructure", "requirements"] as const) {
    if (updates[field]?.length) {
      next[field] = correction
        ? [...new Set(updates[field])]
        : [...new Set([...next[field], ...updates[field]])];
    }
  }
  if (updates.monthlyBudget) next.monthlyBudget = updates.monthlyBudget;
  return next;
}

function nextQuestion(profile: BusinessProfile): string | null {
  const field = missingFields(profile)[0];
  return field ? questions[field] : null;
}

export async function startAdvisorSession(
  session: AdvisorSession,
): Promise<AdvisorSession> {
  const message: AdvisorMessage = {
    role: "assistant",
    content:
      "Hello! I'm your Udyam AI Advisor. I'll help you find the right digital services for your business.\n\nआप हिंदी में भी बात कर सकते हैं। (You can also reply in Hindi or your regional language.)\n\nTo begin, what type of business do you operate?",
    createdAt: new Date().toISOString(),
  };
  session.messages.push(message);
  session.currentQuestion = questions.businessType;
  return saveAdvisorSession(session);
}

export async function processAdvisorMessage(
  session: AdvisorSession,
  message: string,
): Promise<{ session: AdvisorSession; assistantMessage: string; missingFields: string[] }> {
  const userMessage: AdvisorMessage = {
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  };
  const correction = isCorrectionIntent(message);
  const heuristic = heuristicExtraction(message);
  let modelUpdates: Partial<BusinessProfile> = {};
  try {
    modelUpdates = validateExtraction(
      await extractWithGemini(session.profile, message),
    );
  } catch (error) {
    console.error("Advisor extraction failed:", error);
  }
  const merged: Partial<BusinessProfile> = {
    ...heuristic,
    ...modelUpdates,
    monthlyBudget: heuristic.monthlyBudget?.isFlexible
      ? heuristic.monthlyBudget
      : modelUpdates.monthlyBudget ?? heuristic.monthlyBudget,
  };

  // Context-aware fallbacks: when advisor just asked a specific question and heuristic+Gemini both missed
  if (
    !merged.businessType &&
    !session.profile.businessType &&
    session.currentQuestion === questions.businessType
  ) {
    const cleaned = message
      .trim()
      .replace(/^(?:i\s+(?:own|have|run|operate)\s+(?:a|an|the)?\s*|a\s+|an\s+|the\s+)/i, "")
      .slice(0, 60);
    if (cleaned && !/^\d+$/.test(cleaned)) {
      merged.businessType = cleaned;
    }
  }
  if (
    merged.employeeCount === undefined &&
    session.profile.employeeCount === null &&
    session.currentQuestion === questions.employeeCount
  ) {
    const n = parseNumber(message, /(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)/i);
    if (n !== null) merged.employeeCount = n;
  }
  if (
    merged.locationCount === undefined &&
    session.profile.locationCount === null &&
    session.currentQuestion === questions.locationCount
  ) {
    const n = parseNumber(message, /(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)/i);
    if (n !== null) merged.locationCount = n;
  }

  session.profile = mergeProfile(session.profile, merged, correction);
  session.profile.profileComplete = missingFields(session.profile).length === 0;
  session.messages.push(userMessage);
  const fields = missingFields(session.profile);

  if (session.profile.profileComplete) {
    session.status = "complete";
    session.currentQuestion = null;
  } else {
    session.status = "in_progress";
    session.currentQuestion = nextQuestion(session.profile);
  }

  const fallbackMessage = session.profile.profileComplete
    ? "Thanks — I have everything I need. Your business profile is complete. I can now prepare suitable product recommendations."
    : session.currentQuestion ?? "Could you share more about your business needs?";

  let assistantMessage = fallbackMessage;
  try {
    const generated = await generateAdvisorResponse(
      session.profile,
      session.messages.slice(-7, -1),
      message,
      fields,
      session.profile.profileComplete,
    );
    if (generated) assistantMessage = generated;
  } catch (error) {
    console.error("Advisor response generation failed:", error);
  }

  session.messages.push({
    role: "assistant",
    content: assistantMessage,
    createdAt: new Date().toISOString(),
  });
  await saveAdvisorSession(session);
  return { session, assistantMessage, missingFields: fields };
}

export { heuristicExtraction };

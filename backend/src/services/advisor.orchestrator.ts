import {
  getAdvisorSession,
  missingFields,
  saveAdvisorSession,
} from "./advisor.service.js";
import { extractWithGemini, validateExtraction } from "./gemini.service.js";
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
  requirements: "What services are you looking for?",
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

function heuristicExtraction(message: string): Partial<BusinessProfile> {
  const lower = message.toLowerCase();
  const result: Partial<BusinessProfile> = {};
  const employees = parseNumber(
    message,
    /(?:^|\b)(?:with|have|including myself|employees?|people|staff)\D{0,15}(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)/i,
  );
  const locations = parseNumber(
    message,
    /(?:^|\b)(?:have|operate|run|manage)\D{0,15}(\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:branches?|locations?|stores?)/i,
  );
  if (employees !== null) result.employeeCount = employees;
  if (locations !== null) result.locationCount = locations;

  const businessMatch = lower.match(
    /(?:own|run|operate|manage|i am in|i'm in)\s+(?:a|an)?\s*([^,.]+?)(?:\s+with\s+\d|\s+and\s+|\s*$)/i,
  );
  if (businessMatch?.[1]) result.businessType = businessMatch[1].trim();

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
      next[field] = [...new Set([...next[field], ...updates[field]])];
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
      "Hello! I'm your Udyam AI Advisor. I'll help you find the right digital services for your business.\n\nTo begin, what type of business do you operate?",
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
  const heuristic = heuristicExtraction(message);
  let modelUpdates: Partial<BusinessProfile> = {};
  try {
    modelUpdates = validateExtraction(
      await extractWithGemini(session.profile, message),
    );
  } catch (error) {
    console.error("Advisor extraction failed:", error);
  }
  session.profile = mergeProfile(session.profile, {
    ...heuristic,
    ...modelUpdates,
    monthlyBudget: heuristic.monthlyBudget?.isFlexible
      ? heuristic.monthlyBudget
      : modelUpdates.monthlyBudget ?? heuristic.monthlyBudget,
  });
  session.profile.profileComplete = missingFields(session.profile).length === 0;
  session.messages.push(userMessage);
  const fields = missingFields(session.profile);
  let assistantMessage: string;
  if (session.profile.profileComplete) {
    session.status = "complete";
    session.currentQuestion = null;
    assistantMessage =
      "Thanks — I have everything I need. Your business profile is complete. I can now prepare suitable product recommendations.";
  } else {
    session.status = "in_progress";
    session.currentQuestion = nextQuestion(session.profile);
    assistantMessage = session.currentQuestion ?? "Could you share more about your business needs?";
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

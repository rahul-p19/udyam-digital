export type Budget = {
  min: number | null;
  max: number | null;
  currency: "INR";
  isFlexible?: boolean;
};

export type BusinessProfile = {
  businessType: string | null;
  employeeCount: number | null;
  locationCount: number | null;
  currentInfrastructure: string[];
  requirements: string[];
  monthlyBudget: Budget;
  preferredLanguage: string;
  profileComplete: boolean;
};

export type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AdvisorSession = {
  sessionId: string;
  profile: BusinessProfile;
  messages: AdvisorMessage[];
  status: "in_progress" | "complete";
  currentQuestion: string | null;
};

export const requiredProfileFields = [
  "businessType",
  "employeeCount",
  "locationCount",
  "currentInfrastructure",
  "requirements",
  "monthlyBudget",
] as const;

export function createEmptyProfile(): BusinessProfile {
  return {
    businessType: null,
    employeeCount: null,
    locationCount: null,
    currentInfrastructure: [],
    requirements: [],
    monthlyBudget: { min: null, max: null, currency: "INR" },
    preferredLanguage: "en",
    profileComplete: false,
  };
}

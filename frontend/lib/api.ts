const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface BusinessProfile {
  businessType: string | null;
  employeeCount: number | null;
  locationCount: number | null;
  currentInfrastructure: string[];
  requirements: string[];
  monthlyBudget: {
    min: number | null;
    max: number | null;
    currency: "INR";
    isFlexible?: boolean;
  };
  preferredLanguage: string;
  profileComplete: boolean;
}

export interface Product {
  productId: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  monthlyPrice: {
    min: number;
    max: number;
    currency: "INR";
  };
  setupFee: number;
  contractMonths: number;
  typicalInstallDays: number;
}

export interface ScoredProduct extends Product {
  score: number;
  matchReasons: string[];
  eligibleCityTiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGSTIN: boolean;
  targetSegments: string[];
}

interface AdvisorResponse {
  sessionId: string;
  assistantMessage: string;
  businessProfile: BusinessProfile;
  missingFields: string[];
  profileComplete: boolean;
  nextAction: string;
}

interface AuthResponse {
  user: AuthUser;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {}),
    },
    body:
      body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message ===
        "string"
        ? (payload as { error: { message: string } }).error.message
        : "Something went wrong";

    throw new ApiError(response.status, message);
  }

  return payload as T;
}

async function requestWithRefresh<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try {
        await request("/api/auth/refresh", { method: "POST" });
      } catch {
        throw error;
      }
      return request<T>(path, options);
    }
    throw error;
  }
}

export const authApi = {
  register(input: { email: string; password: string; name?: string }) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
    });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
    });
  },

  logout() {
    return request<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
  },

  me() {
    return requestWithRefresh<AuthResponse>("/api/auth/me");
  },
};

export type KycDataCategory =
  | "gst_certificate"
  | "udyam_certificate"
  | "signatory_id"
  | "address_proof";

export type KycPurpose =
  | "identity_verification"
  | "regulatory_compliance"
  | "fraud_prevention";

export interface KycConsent {
  id: string;
  entityType: string;
  consentVersion: string;
  dataCategories: KycDataCategory[];
  purposes: KycPurpose[];
  authorizedSignatory: boolean;
  status: "active" | "withdrawn";
  acceptedAt: string;
  withdrawnAt: string | null;
}

export type KycVerificationStatus = "verified" | "manual_review";

export interface KycVerificationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string | null;
}

export interface KycVerification {
  id: string;
  status: KycVerificationStatus;
  checks: KycVerificationCheck[];
  extracted: {
    gst: {
      gstin: string | null;
      legalName: string | null;
      tradeName: string | null;
      address: string | null;
      status: string | null;
    };
    udyam: {
      udyamNumber: string | null;
      enterpriseName: string | null;
      enterpriseType: string | null;
      majorActivity: string | null;
      state: string | null;
      city: string | null;
    };
    signatory: {
      idType: "mock" | null;
      idMasked: string | null;
      name: string | null;
    };
    addressProof: {
      name: string | null;
      address: string | null;
    };
    ocr: Record<
      string,
      { confidence: number; pages: number; readable: boolean }
    >;
  };
  createdAt: string;
}

export const kycApi = {
  recordConsent(input: {
    consentVersion: string;
    dataCategories: KycDataCategory[];
    purposes: KycPurpose[];
    accepted: boolean;
    authorizedSignatory: boolean;
  }) {
    return requestWithRefresh<{ consent: KycConsent }>("/api/kyc/consent", {
      method: "POST",
      body: input,
    });
  },

  getConsent() {
    return requestWithRefresh<{ consent: KycConsent | null }>(
      "/api/kyc/consent",
    );
  },

  withdrawConsent() {
    return requestWithRefresh<{ consent: KycConsent }>("/api/kyc/consent", {
      method: "DELETE",
    });
  },

  verifyDocuments(formData: FormData) {
    return requestWithRefresh<{ verification: KycVerification }>(
      "/api/kyc/verify",
      {
        method: "POST",
        body: formData,
      },
    );
  },

  getVerification(verificationId: string) {
    return requestWithRefresh<{ verification: KycVerification }>(
      `/api/kyc/verifications/${encodeURIComponent(verificationId)}`,
    );
  },
};

export const advisorApi = {
  createSession() {
    return request<AdvisorResponse>("/api/advisor/session", {
      method: "POST",
    });
  },

  sendMessage(sessionId: string, message: string) {
    return request<AdvisorResponse>("/api/advisor/chat", {
      method: "POST",
      body: { sessionId, message },
    });
  },

  getSession(sessionId: string) {
    return request<{
      sessionId: string;
      profile: BusinessProfile;
      messages: Array<{
        role: "user" | "assistant";
        content: string;
        createdAt: string;
      }>;
      status: "in_progress" | "complete";
    }>(`/api/advisor/session/${encodeURIComponent(sessionId)}`);
  },
};

export const catalogueApi = {
  list() {
    return request<{ products: Product[] }>("/api/products");
  },
};

export interface QuoteProduct {
  productId: string;
  name: string;
  category: string;
  unit: string;
  monthlyPriceMin: number;
  monthlyPriceMax: number;
  setupFee: number;
  contractMonths: number;
  typicalInstallDays: number;
}

export interface Quote {
  quoteId: string;
  sessionId: string;
  products: QuoteProduct[];
  totalMonthlyMin: number;
  totalMonthlyMax: number;
  totalSetupFee: number;
  contractMonths: number;
  status: "draft" | "confirmed" | "expired";
  createdAt: string;
}

export interface Order {
  orderId: string;
  quoteId: string;
  sessionId: string;
  contactName: string;
  contactPhone: string;
  status: "submitted" | "confirmed" | "in_progress" | "activated" | "cancelled";
  estimatedActivationDate: string | null;
  submittedAt: string;
  quote: Quote;
}

export const quoteApi = {
  create(sessionId: string, productIds: string[]) {
    return requestWithRefresh<Quote>("/api/quote", {
      method: "POST",
      body: { sessionId, productIds },
    });
  },
  get(quoteId: string) {
    return requestWithRefresh<Quote>(`/api/quote/${encodeURIComponent(quoteId)}`);
  },
  placeOrder(quoteId: string, contactName: string, contactPhone: string) {
    return requestWithRefresh<Order>("/api/quote/order", {
      method: "POST",
      body: { quoteId, contactName, contactPhone },
    });
  },
  getOrder(orderId: string) {
    return requestWithRefresh<Order>(`/api/quote/order/${encodeURIComponent(orderId)}`);
  },
};

export const recommendationsApi = {
  get(sessionId: string) {
    return request<{
      sessionId: string;
      recommendations: ScoredProduct[];
      explanation: string | null;
    }>(`/api/advisor/recommendations/${encodeURIComponent(sessionId)}`);
  },
};

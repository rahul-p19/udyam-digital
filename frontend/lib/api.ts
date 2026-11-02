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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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

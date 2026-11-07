type CookieSameSite = "lax" | "strict" | "none";

const DEFAULT_ACCESS_SECRET = "dev-access-secret-change-me";
const DEFAULT_REFRESH_SECRET = "dev-refresh-secret-change-me";

const readString = (key: string, fallback: string): string => {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value.trim();
};

const readNumber = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
};

const readBoolean = (key: string, fallback: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new Error(`Environment variable ${key} must be a boolean`);
};

const readSameSite = (key: string, fallback: CookieSameSite): CookieSameSite => {
  const value = readString(key, fallback).toLowerCase();
  if (value === "lax" || value === "strict" || value === "none") {
    return value;
  }
  throw new Error(`Environment variable ${key} must be one of: lax, strict, none`);
};

const nodeEnv = readString("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const accessSecret = readString("JWT_ACCESS_SECRET", DEFAULT_ACCESS_SECRET);
const refreshSecret = readString("JWT_REFRESH_SECRET", DEFAULT_REFRESH_SECRET);

if (isProduction && (accessSecret === DEFAULT_ACCESS_SECRET || refreshSecret === DEFAULT_REFRESH_SECRET)) {
  console.warn(
    "WARNING: Using default JWT secrets in production. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.",
  );
}

const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || undefined;

export const env = {
  nodeEnv,
  isProduction,
  port: readNumber("PORT", 8080),
  databaseUrl: readString(
    "DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/udyam_digital",
  ),
  corsOrigins: readString("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret,
    refreshSecret,
    accessExpiresIn: readString("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: readString("JWT_REFRESH_EXPIRES_IN", "7d"),
  },
  cookie: {
    secure: readBoolean("COOKIE_SECURE", isProduction),
    sameSite: readSameSite("COOKIE_SAME_SITE", isProduction ? "none" : "lax"),
    domain: cookieDomain === "" ? undefined : cookieDomain,
  },
  bcryptRounds: readNumber("BCRYPT_ROUNDS", 10),
  geminiApiKey,
  geminiModel: readString("GEMINI_MODEL", "gemini-2.5-flash"),
  geminiTimeoutMs: readNumber("GEMINI_TIMEOUT_MS", 30000),
  adminSecret: readString("ADMIN_SECRET", "dev-admin-secret"),
};

import { refreshTokenModel } from "../models/refresh-token.model.js";
import {
  userModel,
  type PublicUser,
} from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  createTokenPair,
  verifyRefreshToken,
  type TokenPair,
} from "./token.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const issueTokens = async (user: {
  id: string;
  email: string;
}): Promise<TokenPair> => {
  const tokens = createTokenPair(user);

  await refreshTokenModel.create({
    userId: user.id,
    jti: tokens.refreshJti,
    expiresAt: tokens.refreshExpiresAt,
  });

  return tokens;
};

export const authService = {
  async register(input: {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  }): Promise<AuthResult> {
    const email =
      typeof input.email === "string" ? normalizeEmail(input.email) : "";
    const password =
      typeof input.password === "string" ? input.password : "";
    const name =
      typeof input.name === "string" && input.name.trim() !== ""
        ? input.name.trim()
        : null;

    if (!EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, "A valid email is required");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(
        400,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    if (name && name.length > MAX_NAME_LENGTH) {
      throw new ApiError(
        400,
        `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
      );
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.create({ email, passwordHash, name });
    const tokens = await issueTokens(user);

    return { user: userModel.toPublic(user), tokens };
  },

  async login(input: {
    email?: unknown;
    password?: unknown;
  }): Promise<AuthResult> {
    const email =
      typeof input.email === "string" ? normalizeEmail(input.email) : "";
    const password =
      typeof input.password === "string" ? input.password : "";

    if (!EMAIL_PATTERN.test(email) || password === "") {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid email or password");
    }

    const tokens = await issueTokens(user);
    return { user: userModel.toPublic(user), tokens };
  },

  async refresh(refreshToken?: string): Promise<AuthResult> {
    if (!refreshToken) {
      throw new ApiError(401, "Missing refresh token");
    }

    let payload: { userId: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const storedToken = await refreshTokenModel.findActiveByJti(payload.jti);
    if (!storedToken || storedToken.user_id !== payload.userId) {
      throw new ApiError(401, "Refresh token is no longer valid");
    }

    const user = await userModel.findById(payload.userId);
    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    const revoked = await refreshTokenModel.revokeByJti(payload.jti);
    if (!revoked) {
      throw new ApiError(401, "Refresh token is no longer valid");
    }

    const tokens = await issueTokens(user);
    return { user: userModel.toPublic(user), tokens };
  },

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const { jti } = verifyRefreshToken(refreshToken);
      await refreshTokenModel.revokeByJti(jti);
    } catch {
      // Logging out is best-effort: an invalid token is already unusable.
    }
  },

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return userModel.toPublic(user);
  },
};

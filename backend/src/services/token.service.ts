import crypto from "node:crypto";
import type { CookieOptions, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { parseDurationToSeconds } from "../utils/duration.js";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  type: "access";
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

const accessTtlSeconds = parseDurationToSeconds(env.jwt.accessExpiresIn);
const refreshTtlSeconds = parseDurationToSeconds(env.jwt.refreshExpiresIn);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresAt: Date;
}

export const createTokenPair = (user: {
  id: string;
  email: string;
}): TokenPair => {
  const refreshJti = crypto.randomUUID();

  const accessToken = jwt.sign(
    { email: user.email, type: "access" },
    env.jwt.accessSecret,
    { subject: user.id, expiresIn: accessTtlSeconds },
  );

  const refreshToken = jwt.sign(
    { type: "refresh" },
    env.jwt.refreshSecret,
    { subject: user.id, jwtid: refreshJti, expiresIn: refreshTtlSeconds },
  );

  return {
    accessToken,
    refreshToken,
    refreshJti,
    refreshExpiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
  };
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, env.jwt.accessSecret);

  if (
    typeof payload === "string" ||
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid access token");
  }

  return payload as AccessTokenPayload;
};

export const verifyRefreshToken = (
  token: string,
): { userId: string; jti: string } => {
  const payload = jwt.verify(token, env.jwt.refreshSecret);

  if (
    typeof payload === "string" ||
    payload.type !== "refresh" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }

  const refreshPayload = payload as RefreshTokenPayload;
  return { userId: refreshPayload.sub, jti: refreshPayload.jti };
};

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  domain: env.cookie.domain,
  path: "/",
};

export const setAuthCookies = (res: Response, tokens: TokenPair): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: accessTtlSeconds * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: refreshTtlSeconds * 1000,
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions);
};

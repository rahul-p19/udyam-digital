import type { RequestHandler } from "express";
import {
  ACCESS_TOKEN_COOKIE,
  verifyAccessToken,
} from "../services/token.service.js";
import { ApiError } from "../utils/ApiError.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    next(new ApiError(401, "Not authenticated"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired access token"));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      // Anonymous requests are allowed; protected routes still require auth.
    }
  }

  next();
};

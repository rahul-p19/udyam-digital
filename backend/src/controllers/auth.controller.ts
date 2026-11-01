import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../services/token.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.register(req.body ?? {});
    setAuthCookies(res, tokens);
    res.status(201).json({ user });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.login(req.body ?? {});
    setAuthCookies(res, tokens);
    res.json({ user });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    const { user, tokens } = await authService.refresh(refreshToken);
    setAuthCookies(res, tokens);
    res.json({ user });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    await authService.logout(refreshToken);
    clearAuthCookies(res);
    res.json({ message: "Logged out" });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }
    const user = await authService.getCurrentUser(req.user.id);
    res.json({ user });
  }),
};

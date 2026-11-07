import { Router } from "express";
import {
  chat,
  createSession,
  getSession,
  recommendations,
  setLanguage,
} from "../controllers/advisor.controller.js";

const advisorRouter = Router();

advisorRouter.post("/session", createSession);
advisorRouter.get("/session/:sessionId", getSession);
advisorRouter.post("/session/:sessionId/language", setLanguage);
advisorRouter.post("/chat", chat);
advisorRouter.get("/recommendations/:sessionId", recommendations);

export default advisorRouter;

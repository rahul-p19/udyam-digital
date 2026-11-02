import { Router } from "express";
import {
  chat,
  createSession,
  getSession,
} from "../controllers/advisor.controller.js";

const advisorRouter = Router();

advisorRouter.post("/session", createSession);
advisorRouter.get("/session/:sessionId", getSession);
advisorRouter.post("/chat", chat);

export default advisorRouter;

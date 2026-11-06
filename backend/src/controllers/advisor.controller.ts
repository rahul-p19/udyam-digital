import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import {
  createAdvisorSession,
  getAdvisorSession,
} from "../services/advisor.service.js";
import {
  processAdvisorMessage,
  startAdvisorSession,
} from "../services/advisor.orchestrator.js";
import { computeRecommendations } from "../services/recommendations.service.js";
import { generateBundleExplanation } from "../services/gemini.service.js";

export async function createSession(_req: Request, res: Response): Promise<void> {
  const session = await startAdvisorSession(await createAdvisorSession());
  res.status(201).json({
    sessionId: session.sessionId,
    assistantMessage: session.messages[0].content,
    businessProfile: session.profile,
    missingFields: [
      "businessType",
      "employeeCount",
      "locationCount",
      "currentInfrastructure",
      "requirements",
      "monthlyBudget",
    ],
    profileComplete: false,
    nextAction: "ask_question",
  });
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await getAdvisorSession(req.params.sessionId);
  if (!session) throw new ApiError(404, "Advisor session not found");
  res.json(session);
}

export async function recommendations(req: Request, res: Response): Promise<void> {
  const session = await getAdvisorSession(req.params.sessionId);
  if (!session) throw new ApiError(404, "Advisor session not found");

  const conversationText = session.messages.map((m) => m.content).join(" ");
  const scored = computeRecommendations(session.profile, conversationText);

  let explanation: string | null = null;
  try {
    explanation = await generateBundleExplanation(session.profile, scored);
  } catch {
    // explanation is optional — don't fail the request
  }

  res.json({ sessionId: session.sessionId, recommendations: scored, explanation });
}

export async function chat(req: Request, res: Response): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!sessionId || !message) {
    throw new ApiError(400, "sessionId and a non-empty message are required");
  }
  if (message.length > 2000) {
    throw new ApiError(400, "Message must be 2000 characters or fewer");
  }
  const session = await getAdvisorSession(sessionId);
  if (!session) throw new ApiError(404, "Advisor session not found");
  if (session.status === "complete") {
    throw new ApiError(409, "This advisor session is already complete");
  }
  const result = await processAdvisorMessage(session, message);
  res.json({
    sessionId: result.session.sessionId,
    assistantMessage: result.assistantMessage,
    businessProfile: result.session.profile,
    missingFields: result.missingFields,
    profileComplete: result.session.profile.profileComplete,
    nextAction: result.session.profile.profileComplete
      ? "generate_recommendations"
      : "ask_question",
  });
}

import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import {
  createEmptyProfile,
  requiredProfileFields,
  type AdvisorMessage,
  type AdvisorSession,
  type BusinessProfile,
} from "../types/advisor.js";

type StoredSession = {
  session_id: string;
  profile: BusinessProfile;
  messages: AdvisorMessage[];
  status: AdvisorSession["status"];
  current_question: string | null;
};

const rowToSession = (row: StoredSession): AdvisorSession => ({
  sessionId: row.session_id,
  profile: row.profile,
  messages: row.messages,
  status: row.status,
  currentQuestion: row.current_question,
});

export async function createAdvisorSession(): Promise<AdvisorSession> {
  const sessionId = randomUUID();
  const profile = createEmptyProfile();
  const result = await query<StoredSession>(
    `INSERT INTO advisor_sessions (id, profile, messages, status)
     VALUES ($1, $2::jsonb, '[]'::jsonb, 'in_progress')
     RETURNING id AS session_id, profile, messages, status, current_question`,
    [sessionId, JSON.stringify(profile)],
  );
  return rowToSession(result.rows[0]);
}

export async function getAdvisorSession(
  sessionId: string,
): Promise<AdvisorSession | null> {
  const result = await query<StoredSession>(
    `SELECT id AS session_id, profile, messages, status, current_question
     FROM advisor_sessions WHERE id = $1`,
    [sessionId],
  );
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function saveAdvisorSession(
  session: AdvisorSession,
): Promise<AdvisorSession> {
  const result = await query<StoredSession>(
    `UPDATE advisor_sessions
     SET profile = $2::jsonb, messages = $3::jsonb, status = $4,
         current_question = $5, updated_at = now()
     WHERE id = $1
     RETURNING id AS session_id, profile, messages, status, current_question`,
    [
      session.sessionId,
      JSON.stringify(session.profile),
      JSON.stringify(session.messages),
      session.status,
      session.currentQuestion,
    ],
  );
  return rowToSession(result.rows[0]);
}

export function missingFields(profile: BusinessProfile): string[] {
  return requiredProfileFields.filter((field) => {
    if (field === "businessType") return !profile.businessType;
    if (field === "employeeCount" || field === "locationCount") {
      return profile[field] === null;
    }
    if (field === "monthlyBudget") {
      return (
        profile.monthlyBudget.min === null &&
        profile.monthlyBudget.max === null &&
        !profile.monthlyBudget.isFlexible
      );
    }
    return profile[field].length === 0;
  });
}

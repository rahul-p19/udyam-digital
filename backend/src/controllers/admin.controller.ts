import type { Request, Response } from "express";
import { query } from "../db/pool.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

interface LeadRow {
  session_id: string;
  profile: {
    businessType: string | null;
    employeeCount: number | null;
    locationCount: number | null;
    currentInfrastructure: string[];
    requirements: string[];
    monthlyBudget: { min: number | null; max: number | null; isFlexible?: boolean };
    preferredLanguage: string;
    profileComplete: boolean;
  };
  message_count: number;
  created_at: Date;
  updated_at: Date;
  has_order: boolean;
}

interface KycQueueRow {
  id: string;
  user_id: string;
  status: string;
  checks: Array<{ key: string; label: string; passed: boolean; detail: string | null }>;
  extracted_data: Record<string, unknown>;
  created_at: Date;
  user_email: string;
  user_name: string | null;
}

export const adminController = {
  listLeads: asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<LeadRow>(
      `SELECT
         s.id AS session_id,
         s.profile,
         jsonb_array_length(s.messages) AS message_count,
         s.created_at,
         s.updated_at,
         EXISTS(
           SELECT 1 FROM orders o WHERE o.session_id = s.id::text
         ) AS has_order
       FROM advisor_sessions s
       ORDER BY s.updated_at DESC
       LIMIT 200`,
    );

    const leads = result.rows.map((row) => ({
      sessionId: row.session_id,
      businessType: row.profile.businessType,
      employeeCount: row.profile.employeeCount,
      locationCount: row.profile.locationCount,
      requirements: row.profile.requirements,
      preferredLanguage: row.profile.preferredLanguage,
      profileComplete: row.profile.profileComplete,
      messageCount: Number(row.message_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hasOrder: row.has_order,
      dropStage: row.has_order
        ? "ordered"
        : row.profile.profileComplete
          ? "quote_or_checkout"
          : "advisor",
    }));

    res.json({ leads });
  }),

  listKycQueue: asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<KycQueueRow>(
      `SELECT
         v.id,
         v.user_id,
         v.status,
         v.checks,
         v.extracted_data,
         v.created_at,
         u.email AS user_email,
         u.name AS user_name
       FROM kyc_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.status = 'manual_review'
       ORDER BY v.created_at ASC`,
    );

    const queue = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      status: row.status,
      checks: row.checks,
      extracted: row.extracted_data,
      createdAt: row.created_at,
      failedChecks: row.checks.filter((c) => !c.passed).length,
    }));

    res.json({ queue });
  }),

  getKycCase: asyncHandler(async (req: Request, res: Response) => {
    const { verificationId } = req.params;

    const result = await query<KycQueueRow>(
      `SELECT
         v.id,
         v.user_id,
         v.status,
         v.checks,
         v.extracted_data,
         v.created_at,
         u.email AS user_email,
         u.name AS user_name
       FROM kyc_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [verificationId],
    );

    if (!result.rows[0]) throw new ApiError(404, "Verification not found");

    const row = result.rows[0];
    res.json({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      status: row.status,
      checks: row.checks,
      extracted: row.extracted_data,
      createdAt: row.created_at,
    });
  }),

  approveKyc: asyncHandler(async (req: Request, res: Response) => {
    const { verificationId } = req.params;

    const result = await query<{ id: string; status: string }>(
      `UPDATE kyc_verifications
       SET status = 'verified'
       WHERE id = $1 AND status = 'manual_review'
       RETURNING id, status`,
      [verificationId],
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Verification not found or not in manual review");
    }

    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  }),

  rejectKyc: asyncHandler(async (req: Request, res: Response) => {
    const { verificationId } = req.params;

    const result = await query<{ id: string; status: string }>(
      `UPDATE kyc_verifications
       SET status = 'rejected'
       WHERE id = $1 AND status = 'manual_review'
       RETURNING id, status`,
      [verificationId],
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Verification not found or not in manual review");
    }

    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  }),
};

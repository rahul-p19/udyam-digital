import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { query } from "../db/pool.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "../../data");

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

type PropensityTier = "HIGH" | "MED" | "LOW";

interface PropensityResult {
  score: number;
  tier: PropensityTier;
  signals: string[];
}

function computePropensity(profile: LeadRow["profile"]): PropensityResult {
  let score = 0;
  const signals: string[] = [];

  if (profile.profileComplete) {
    score += 30;
    signals.push("Profile complete");
  }

  const reqCount = profile.requirements?.length ?? 0;
  if (reqCount > 0) {
    const pts = Math.min(reqCount * 5, 20);
    score += pts;
    signals.push(`${reqCount} service${reqCount > 1 ? "s" : ""} identified`);
  }

  const budget = profile.monthlyBudget;
  if (budget?.isFlexible) {
    score += 10;
    signals.push("Flexible budget");
  } else if (budget?.min !== null || budget?.max !== null) {
    score += 15;
    const max = budget?.max ?? budget?.min;
    if (max) signals.push(`Budget ₹${max.toLocaleString("en-IN")}/mo`);
  }

  const sites = profile.locationCount ?? 0;
  if (sites > 1) {
    score += 10;
    signals.push(`${sites} locations`);
  }

  const emp = profile.employeeCount ?? 0;
  if (emp >= 10) {
    score += 10;
    signals.push(`${emp} employees`);
  } else if (emp >= 5) {
    score += 5;
    signals.push(`${emp} employees`);
  }

  if (profile.businessType) {
    score += 5;
  }

  const tier: PropensityTier = score >= 60 ? "HIGH" : score >= 30 ? "MED" : "LOW";
  return { score, tier, signals };
}

// ── Historical funnel from smb_leads.csv ──────────────────────────────────────

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

interface HistoricalFunnel {
  stages: Array<{ label: string; count: number; pct: number | null }>;
  dropReasons: Array<{ reason: string; count: number }>;
  segmentBreakdown: Array<{ segment: string; total: number; activated: number; activationRate: number }>;
  avgDaysToActivation: number;
  avgAcquisitionCost: number;
  gstinActivationRate: number;
  noGstinActivationRate: number;
}

let _historicalFunnel: HistoricalFunnel | null = null;

function getHistoricalFunnel(): HistoricalFunnel {
  if (_historicalFunnel) return _historicalFunnel;

  let rows: Record<string, string>[] = [];
  try {
    rows = parseCsvRows(readFileSync(join(DATA_DIR, "smb_leads.csv"), "utf8"));
  } catch {
    _historicalFunnel = {
      stages: [],
      dropReasons: [],
      segmentBreakdown: [],
      avgDaysToActivation: 0,
      avgAcquisitionCost: 0,
      gstinActivationRate: 0,
      noGstinActivationRate: 0,
    };
    return _historicalFunnel;
  }

  const STAGE_ORDER = [
    "Lead",
    "Contacted",
    "Needs assessed",
    "Quote accepted",
    "KYC complete",
    "Activated",
  ];

  const stageCounts: Record<string, number> = {};
  for (const s of STAGE_ORDER) stageCounts[s] = 0;

  const stageIndex: Record<string, number> = {};
  for (let i = 0; i < STAGE_ORDER.length; i++) stageIndex[STAGE_ORDER[i]] = i;

  const dropReasonMap = new Map<string, number>();
  const segMap = new Map<string, { total: number; activated: number }>();

  let daysSum = 0;
  let daysCount = 0;
  let costSum = 0;
  let costCount = 0;
  let gstinActivated = 0;
  let gstinTotal = 0;
  let noGstinActivated = 0;
  let noGstinTotal = 0;

  for (const row of rows) {
    const stage = row.stage_reached?.trim();
    const idx = stage !== undefined ? stageIndex[stage] : undefined;
    if (idx !== undefined) {
      for (let i = 0; i <= idx; i++) stageCounts[STAGE_ORDER[i]]++;
    }

    if (row.outcome === "Dropped" && row.drop_reason?.trim()) {
      const r = row.drop_reason.trim();
      dropReasonMap.set(r, (dropReasonMap.get(r) ?? 0) + 1);
    }

    const seg = row.segment?.trim() || "Unknown";
    const isActivated = row.outcome === "Activated";
    if (!segMap.has(seg)) segMap.set(seg, { total: 0, activated: 0 });
    const s = segMap.get(seg)!;
    s.total++;
    if (isActivated) s.activated++;

    if (isActivated) {
      const days = parseFloat(row.days_lead_to_activation);
      if (!isNaN(days) && days > 0) { daysSum += days; daysCount++; }
      const cost = parseFloat(row.acquisition_cost_inr);
      if (!isNaN(cost) && cost > 0) { costSum += cost; costCount++; }
    }

    const hasGstin = row.has_gstin?.trim().toUpperCase() === "Y";
    if (hasGstin) {
      gstinTotal++;
      if (isActivated) gstinActivated++;
    } else {
      noGstinTotal++;
      if (isActivated) noGstinActivated++;
    }
  }

  const totalLeads = stageCounts[STAGE_ORDER[0]] || 1;
  const stages = STAGE_ORDER.map((label, i) => ({
    label,
    count: stageCounts[label],
    pct: i === 0 ? null : Math.round((stageCounts[label] / totalLeads) * 100),
  }));

  const dropReasons = [...dropReasonMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));

  const segmentBreakdown = [...segMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([segment, { total: t, activated: a }]) => ({
      segment,
      total: t,
      activated: a,
      activationRate: t > 0 ? Math.round((a / t) * 1000) / 10 : 0,
    }));

  _historicalFunnel = {
    stages,
    dropReasons,
    segmentBreakdown,
    avgDaysToActivation: daysCount > 0 ? Math.round((daysSum / daysCount) * 10) / 10 : 0,
    avgAcquisitionCost: costCount > 0 ? Math.round(costSum / costCount) : 0,
    gstinActivationRate: gstinTotal > 0 ? Math.round((gstinActivated / gstinTotal) * 1000) / 10 : 0,
    noGstinActivationRate: noGstinTotal > 0 ? Math.round((noGstinActivated / noGstinTotal) * 1000) / 10 : 0,
  };

  return _historicalFunnel;
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

    const leads = result.rows.map((row) => {
      const propensity = computePropensity(row.profile);
      return {
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
        propensityScore: propensity.score,
        propensityTier: propensity.tier,
        propensitySignals: propensity.signals,
      };
    });

    res.json({ leads });
  }),

  getFunnelAnalytics: asyncHandler(async (_req: Request, res: Response) => {
    const liveResult = await query<{
      total_sessions: string;
      profile_complete: string;
      total_quotes: string;
      total_orders: string;
    }>(
      `SELECT
         COUNT(DISTINCT s.id)::text AS total_sessions,
         COUNT(DISTINCT s.id) FILTER (WHERE s.profile->>'profileComplete' = 'true')::text AS profile_complete,
         COUNT(DISTINCT q.id)::text AS total_quotes,
         COUNT(DISTINCT o.id)::text AS total_orders
       FROM advisor_sessions s
       LEFT JOIN quotes q ON q.session_id = s.id::text
       LEFT JOIN orders o ON o.session_id = s.id::text`,
    );

    const propRows = await query<{ tier: string; count: string }>(
      `SELECT
         CASE
           WHEN (profile->>'profileComplete')::boolean THEN 'HIGH_PROXY'
           WHEN jsonb_array_length(COALESCE(profile->'requirements', '[]'::jsonb)) >= 2 THEN 'MED_PROXY'
           ELSE 'LOW_PROXY'
         END AS tier,
         COUNT(*)::text AS count
       FROM advisor_sessions
       WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.session_id = id::text)
       GROUP BY 1`,
    );

    const live = liveResult.rows[0];
    const historical = getHistoricalFunnel();

    res.json({
      live: {
        totalSessions: Number(live.total_sessions),
        profileComplete: Number(live.profile_complete),
        totalQuotes: Number(live.total_quotes),
        totalOrders: Number(live.total_orders),
        droppedInAdvisor: Number(live.total_sessions) - Number(live.profile_complete),
        droppedAtCheckout: Number(live.profile_complete) - Number(live.total_orders),
      },
      propensityBreakdown: propRows.rows.map((r) => ({
        tier: r.tier.replace("_PROXY", ""),
        count: Number(r.count),
      })),
      historical,
    });
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

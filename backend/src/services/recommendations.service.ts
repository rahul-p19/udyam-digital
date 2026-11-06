import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BusinessProfile } from "../types/advisor.js";

export interface CatalogProduct {
  productId: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  monthlyPrice: { min: number; max: number; currency: "INR" };
  setupFee: number;
  contractMonths: number;
  eligibleCityTiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGSTIN: boolean;
  requiredProducts: string[];
  typicalInstallDays: number;
  targetSegments: string[];
}

export interface ScoredProduct extends CatalogProduct {
  score: number;
  matchReasons: string[];
}

type CollabMap = Map<string, Map<string, number>>;

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "../../data");

let catalogue: CatalogProduct[] = [];
const collabMap: CollabMap = new Map();

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

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function normaliseCsvSegment(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("manufactur")) return "mfg";
  if (lower.includes("multi")) return "multi";
  if (lower.includes("professional")) return "prof";
  return "micro";
}

export function detectSegment(businessType: string): string {
  const lower = businessType.toLowerCase();
  if (/manufactur|factory|unit|textile|auto|industrial|workshop|assembl/.test(lower)) return "mfg";
  if (/chain|franchise|outlets|branches|multi.?site/.test(lower)) return "multi";
  if (/clinic|doctor|dentist|\bca\b|chartered|coaching|consultant|law|audit|architect|hospital|diagnostic|lab/.test(lower)) return "prof";
  return "micro";
}

export function detectCityTier(text: string): number {
  return /mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|pune|kolkata|ahmedabad|surat/i.test(text)
    ? 1
    : 2;
}

function initData(): void {
  try {
    catalogue = JSON.parse(
      readFileSync(join(DATA_DIR, "product_catalogue.json"), "utf8"),
    ) as CatalogProduct[];
  } catch (err) {
    console.error("Failed to load product catalogue:", err);
    catalogue = [];
  }

  try {
    const rows = parseCsv(readFileSync(join(DATA_DIR, "smb_leads.csv"), "utf8"));
    for (const row of rows) {
      if (row.outcome !== "Activated" || !row.bundle_products) continue;
      const seg = normaliseCsvSegment(row.segment ?? "");
      if (!collabMap.has(seg)) collabMap.set(seg, new Map());
      const segMap = collabMap.get(seg)!;
      const nps = parseFloat(row.nps_score) || 5;
      for (const bundle of row.bundle_products.split(";")) {
        const pid = bundle.replace(/x\d+$/i, "").trim();
        if (pid) segMap.set(pid, (segMap.get(pid) ?? 0) + nps);
      }
    }
  } catch (err) {
    console.error("Failed to load smb_leads.csv for collaborative filtering:", err);
  }
}

initData();

function collabScore(productId: string, segment: string): number {
  const segMap = collabMap.get(segment);
  if (!segMap || !segMap.has(productId)) return 0;
  const max = Math.max(...segMap.values());
  return max > 0 ? ((segMap.get(productId) ?? 0) / max) * 10 : 0;
}

function requirementMatch(
  product: CatalogProduct,
  requirements: string[],
): { score: number; reasons: string[] } {
  const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  for (const req of requirements) {
    if (text.includes(req.replaceAll("_", " "))) {
      score += 4;
      reasons.push(`matches your need for ${req.replaceAll("_", " ")}`);
    }
  }
  return { score, reasons };
}

function budgetFit(
  product: CatalogProduct,
  budget: BusinessProfile["monthlyBudget"],
): { score: number; reason: string | null } {
  if (budget.isFlexible) return { score: 1, reason: null };
  const max = budget.max ?? budget.min;
  if (max === null) return { score: 0, reason: null };
  if (product.monthlyPrice.min <= max) {
    return {
      score: 2,
      reason: `fits within your ₹${max.toLocaleString("en-IN")}/month budget`,
    };
  }
  return { score: 0, reason: null };
}

export function computeRecommendations(
  profile: BusinessProfile,
  conversationText = "",
  hasGSTIN = false,
  limit = 6,
): ScoredProduct[] {
  if (catalogue.length === 0) return [];

  const segment = detectSegment(profile.businessType ?? "");
  const cityTier = detectCityTier(conversationText);
  const employees = profile.employeeCount ?? 1;
  const sites = profile.locationCount ?? 1;

  return catalogue
    .filter((p) => {
      if (!p.eligibleCityTiers.includes(cityTier) && !p.eligibleCityTiers.includes(2)) return false;
      if (p.minEmployees > employees) return false;
      if (p.minSites > sites) return false;
      if (p.requiresGSTIN && !hasGSTIN) return false;
      return true;
    })
    .map((product) => {
      const collab = collabScore(product.productId, segment);
      const { score: reqScore, reasons: reqReasons } = requirementMatch(product, profile.requirements);
      const { score: budScore, reason: budReason } = budgetFit(product, profile.monthlyBudget);
      const segBonus = product.targetSegments.includes(segment) ? 2 : 0;

      const score = collab * 1.5 + reqScore + budScore + segBonus;

      const matchReasons: string[] = [...reqReasons];
      if (budReason) matchReasons.push(budReason);
      if (collab > 6) matchReasons.push(`popular with similar ${profile.businessType ?? "businesses"}`);
      if (segBonus > 0) matchReasons.push("designed for your business type");

      return { ...product, score, matchReasons };
    })
    .sort((a, b) => b.score - a.score || a.monthlyPrice.min - b.monthlyPrice.min)
    .slice(0, limit);
}

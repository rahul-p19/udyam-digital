import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import { getProducts } from "./catalogue.service.js";
import { ApiError } from "../utils/ApiError.js";

export interface QuoteProduct {
  productId: string;
  name: string;
  category: string;
  unit: string;
  monthlyPriceMin: number;
  monthlyPriceMax: number;
  setupFee: number;
  contractMonths: number;
  typicalInstallDays: number;
}

export interface Quote {
  quoteId: string;
  sessionId: string;
  products: QuoteProduct[];
  totalMonthlyMin: number;
  totalMonthlyMax: number;
  totalSetupFee: number;
  contractMonths: number;
  status: "draft" | "confirmed" | "expired";
  createdAt: string;
}

type StoredQuote = {
  id: string;
  session_id: string;
  products: QuoteProduct[];
  total_monthly_min: number;
  total_monthly_max: number;
  total_setup_fee: number;
  contract_months: number;
  status: Quote["status"];
  created_at: string;
};

function rowToQuote(row: StoredQuote): Quote {
  return {
    quoteId: row.id,
    sessionId: row.session_id,
    products: row.products,
    totalMonthlyMin: row.total_monthly_min,
    totalMonthlyMax: row.total_monthly_max,
    totalSetupFee: row.total_setup_fee,
    contractMonths: row.contract_months,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createQuote(
  sessionId: string,
  selectedProductIds: string[],
): Promise<Quote | null> {
  const allProducts = await getProducts();
  const products: QuoteProduct[] = selectedProductIds
    .map((id) => allProducts.find((p) => p.productId === id))
    .filter(Boolean)
    .map((p) => ({
      productId: p!.productId,
      name: p!.name,
      category: p!.category,
      unit: p!.unit,
      monthlyPriceMin: p!.monthlyPrice.min,
      monthlyPriceMax: p!.monthlyPrice.max,
      setupFee: p!.setupFee,
      contractMonths: p!.contractMonths,
      typicalInstallDays: p!.typicalInstallDays,
    }));

  if (products.length === 0) return null;

  // Dependency check: each selected product's requiredProducts must have ≥1 in the bundle
  const selectedSet = new Set(products.map((p) => p.productId));
  for (const id of selectedProductIds) {
    const full = allProducts.find((p) => p.productId === id);
    if (full && full.requiredProducts.length > 0) {
      const satisfied = full.requiredProducts.some((dep) => selectedSet.has(dep));
      if (!satisfied) {
        const depNames = full.requiredProducts
          .map((dep) => allProducts.find((p) => p.productId === dep)?.name ?? dep)
          .join(" or ");
        throw new ApiError(
          422,
          `${full.name} requires at least one of: ${depNames}. Please add a compatible broadband product to your bundle.`,
        );
      }
    }
  }

  const totalMonthlyMin = products.reduce((s, p) => s + p.monthlyPriceMin, 0);
  const totalMonthlyMax = products.reduce((s, p) => s + p.monthlyPriceMax, 0);
  const totalSetupFee = products.reduce((s, p) => s + p.setupFee, 0);
  const contractMonths = Math.max(...products.map((p) => p.contractMonths));

  const result = await query<StoredQuote>(
    `INSERT INTO quotes (id, session_id, products, total_monthly_min, total_monthly_max, total_setup_fee, contract_months)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING id, session_id, products, total_monthly_min, total_monthly_max, total_setup_fee, contract_months, status, created_at`,
    [
      randomUUID(),
      sessionId,
      JSON.stringify(products),
      totalMonthlyMin,
      totalMonthlyMax,
      totalSetupFee,
      contractMonths,
    ],
  );

  return rowToQuote(result.rows[0]);
}

export async function getQuote(quoteId: string): Promise<Quote | null> {
  const result = await query<StoredQuote>(
    `SELECT id, session_id, products, total_monthly_min, total_monthly_max, total_setup_fee, contract_months, status, created_at
     FROM quotes WHERE id = $1`,
    [quoteId],
  );
  return result.rows[0] ? rowToQuote(result.rows[0]) : null;
}

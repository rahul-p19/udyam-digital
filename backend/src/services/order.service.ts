import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import { getQuote, type Quote } from "./quote.service.js";
import { ApiError } from "../utils/ApiError.js";

export interface Order {
  orderId: string;
  quoteId: string;
  sessionId: string;
  contactName: string;
  contactPhone: string;
  status: "submitted" | "confirmed" | "in_progress" | "activated" | "cancelled";
  estimatedActivationDate: string | null;
  submittedAt: string;
  quote: Quote;
}

type StoredOrder = {
  id: string;
  quote_id: string;
  session_id: string;
  contact_name: string;
  contact_phone: string;
  status: Order["status"];
  estimated_activation_date: string | null;
  submitted_at: string;
};

function rowToOrder(row: StoredOrder, quote: Quote): Order {
  return {
    orderId: row.id,
    quoteId: row.quote_id,
    sessionId: row.session_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: row.status,
    estimatedActivationDate: row.estimated_activation_date,
    submittedAt: row.submitted_at,
    quote,
  };
}

function activationDate(maxInstallDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + maxInstallDays + 2); // +2 buffer days
  return d.toISOString().slice(0, 10);
}

export async function createOrder(
  quoteId: string,
  contactName: string,
  contactPhone: string,
  userId: string,
): Promise<Order | null> {
  const kycResult = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM kyc_verifications
       WHERE user_id = $1 AND status = 'verified'
       LIMIT 1
     ) AS exists`,
    [userId],
  );
  if (!kycResult.rows[0]?.exists) {
    throw new ApiError(403, "Business KYC verification is required before placing an order");
  }

  const quote = await getQuote(quoteId);
  if (!quote || quote.status === "expired") return null;

  const maxDays = Math.max(...quote.products.map((p) => p.typicalInstallDays), 5);
  const estDate = activationDate(maxDays);

  // Mark quote as confirmed
  await query("UPDATE quotes SET status = 'confirmed', updated_at = now() WHERE id = $1", [quoteId]);

  const result = await query<StoredOrder>(
    `INSERT INTO orders (id, quote_id, session_id, user_id, contact_name, contact_phone, estimated_activation_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, quote_id, session_id, contact_name, contact_phone, status, estimated_activation_date, submitted_at`,
    [
      randomUUID(),
      quoteId,
      quote.sessionId,
      userId,
      contactName.trim(),
      contactPhone.trim(),
      estDate,
    ],
  );

  return rowToOrder(result.rows[0], quote);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const result = await query<StoredOrder>(
    `SELECT id, quote_id, session_id, contact_name, contact_phone, status, estimated_activation_date, submitted_at
     FROM orders WHERE id = $1`,
    [orderId],
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const quote = await getQuote(row.quote_id);
  if (!quote) return null;
  return rowToOrder(row, quote);
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const result = await query<StoredOrder>(
    `SELECT id, quote_id, session_id, contact_name, contact_phone, status, estimated_activation_date, submitted_at
     FROM orders WHERE user_id = $1 ORDER BY submitted_at DESC`,
    [userId],
  );

  const orders = await Promise.all(
    result.rows.map(async (row) => {
      const quote = await getQuote(row.quote_id);
      return quote ? rowToOrder(row, quote) : null;
    }),
  );

  return orders.filter((order): order is Order => order !== null);
}

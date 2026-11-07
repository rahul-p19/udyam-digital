import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { createQuote, getQuote } from "../services/quote.service.js";
import { createOrder, getOrder, getOrdersByUser } from "../services/order.service.js";

export async function createQuoteHandler(req: Request, res: Response): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const productIds: unknown = req.body?.productIds;

  if (!sessionId) throw new ApiError(400, "sessionId is required");
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ApiError(400, "productIds must be a non-empty array");
  }
  const ids = productIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (ids.length === 0) throw new ApiError(400, "No valid product IDs provided");

  const quote = await createQuote(sessionId, ids);
  if (!quote) throw new ApiError(422, "None of the provided product IDs are valid");

  res.status(201).json(quote);
}

export async function getQuoteHandler(req: Request, res: Response): Promise<void> {
  const quote = await getQuote(req.params.quoteId);
  if (!quote) throw new ApiError(404, "Quote not found");
  res.json(quote);
}

export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  const quoteId =
    typeof req.body?.quoteId === "string" ? req.body.quoteId.trim() : "";
  const contactName =
    typeof req.body?.contactName === "string" ? req.body.contactName.trim() : "";
  const contactPhone =
    typeof req.body?.contactPhone === "string" ? req.body.contactPhone.trim() : "";

  if (!quoteId) throw new ApiError(400, "quoteId is required");
  if (!contactName) throw new ApiError(400, "contactName is required");
  if (!contactPhone) throw new ApiError(400, "contactPhone is required");
  if (!/^\+?[\d\s\-]{7,15}$/.test(contactPhone)) {
    throw new ApiError(400, "Invalid phone number");
  }

  if (!req.user) throw new ApiError(401, "Not authenticated");
  const order = await createOrder(quoteId, contactName, contactPhone, req.user.id);
  if (!order) throw new ApiError(404, "Quote not found or already expired");

  res.status(201).json(order);
}

export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ApiError(401, "Not authenticated");

  const orders = await getOrdersByUser(req.user.id);
  res.json({ orders });
}

export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  const order = await getOrder(req.params.orderId);
  if (!order) throw new ApiError(404, "Order not found");
  res.json(order);
}

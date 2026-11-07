import { Router } from "express";
import {
  createQuoteHandler,
  createOrderHandler,
  getOrderHandler,
  getQuoteHandler,
  listOrdersHandler,
} from "../controllers/quote.controller.js";
import {
  optionalAuth,
  requireAuth,
} from "../middleware/auth.middleware.js";

const quoteRouter = Router();

quoteRouter.post("/", createQuoteHandler);
quoteRouter.get("/orders", requireAuth, listOrdersHandler);
quoteRouter.post("/order", optionalAuth, createOrderHandler);
quoteRouter.get("/order/:orderId", getOrderHandler);
quoteRouter.get("/:quoteId", getQuoteHandler);

export default quoteRouter;

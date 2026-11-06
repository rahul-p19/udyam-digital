import { Router } from "express";
import {
  createQuoteHandler,
  createOrderHandler,
  getOrderHandler,
  getQuoteHandler,
} from "../controllers/quote.controller.js";

const quoteRouter = Router();

quoteRouter.post("/", createQuoteHandler);
quoteRouter.post("/order", createOrderHandler);
quoteRouter.get("/order/:orderId", getOrderHandler);
quoteRouter.get("/:quoteId", getQuoteHandler);

export default quoteRouter;

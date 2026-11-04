import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import catalogueRouter from "./routes/catalogue.route.js";
import advisorRouter from "./routes/advisor.route.js";
import kycRouter from "./routes/kyc.route.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", catalogueRouter);
  app.use("/api/advisor", advisorRouter);
  app.use("/api/kyc", kycRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

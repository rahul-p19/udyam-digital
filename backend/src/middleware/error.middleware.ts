import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

interface PostgresError {
  code?: string;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { message: err.message },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      error: {
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 8 MB or smaller"
            : "File upload failed",
      },
    });
    return;
  }

  const postgresError = err as PostgresError;
  if (postgresError?.code === "23505") {
    res.status(409).json({
      error: { message: "A record with that value already exists" },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      message:
        env.isProduction || !(err instanceof Error)
          ? "Internal server error"
          : err.message,
    },
  });
};

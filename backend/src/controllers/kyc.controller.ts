import type { Request, Response } from "express";
import { kycService } from "../services/kyc.service.js";
import { kycVerificationService } from "../services/kyc-verification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Not authenticated");
  }
  return req.user;
}

export const kycController = {
  recordConsent: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const userAgent = req.get("user-agent") ?? null;

    const consent = await kycService.recordConsent(user.id, req.body ?? {}, {
      ipAddress: req.ip ?? null,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
    });

    res.status(201).json({ consent });
  }),

  getConsent: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const consent = await kycService.getLatestConsent(user.id);

    res.json({ consent });
  }),

  withdrawConsent: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const consent = await kycService.withdrawLatestConsent(user.id);

    if (!consent) {
      throw new ApiError(404, "No active KYC consent found");
    }

    res.json({ consent });
  }),

  verifyDocuments: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;

    const gstCertificate = files?.gstCertificate?.[0];
    const udyamCertificate = files?.udyamCertificate?.[0];
    const signatoryId = files?.signatoryId?.[0];
    const addressProof = files?.addressProof?.[0];

    if (!gstCertificate || !udyamCertificate || !signatoryId || !addressProof) {
      throw new ApiError(
        400,
        "GST certificate, Udyam certificate, signatory ID, and address proof are all required",
      );
    }

    const verification = await kycVerificationService.verifyDocuments(user.id, {
      gstCertificate,
      udyamCertificate,
      signatoryId,
      addressProof,
    });

    res.status(200).json({ verification });
  }),

  getVerification: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const verification = await kycVerificationService.getVerification(
      user.id,
      req.params.verificationId,
    );

    res.json({ verification });
  }),
};

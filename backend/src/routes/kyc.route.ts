import { Router } from "express";
import multer from "multer";
import { kycController } from "../controllers/kyc.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { ApiError } from "../utils/ApiError.js";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 4,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new ApiError(400, "Only JPG, PNG, and PDF files are supported"),
      );
      return;
    }

    callback(null, true);
  },
});

const kycRouter = Router();

kycRouter.use(requireAuth);

kycRouter.post("/consent", kycController.recordConsent);
kycRouter.get("/consent", kycController.getConsent);
kycRouter.delete("/consent", kycController.withdrawConsent);
kycRouter.get(
  "/verifications/:verificationId",
  kycController.getVerification,
);
kycRouter.post(
  "/verify",
  documentUpload.fields([
    { name: "gstCertificate", maxCount: 1 },
    { name: "udyamCertificate", maxCount: 1 },
    { name: "signatoryId", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
  ]),
  kycController.verifyDocuments,
);

export default kycRouter;

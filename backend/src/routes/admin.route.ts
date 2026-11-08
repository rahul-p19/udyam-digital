import { Router, type Request, type Response, type NextFunction } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { adminController } from "../controllers/admin.controller.js";

const adminRouter = Router();

adminRouter.use((req: Request, _res: Response, next: NextFunction) => {
  const key = req.headers["x-admin-key"];
  if (!key || key !== env.adminSecret) {
    next(new ApiError(401, "Invalid admin key"));
    return;
  }
  next();
});

adminRouter.get("/analytics", adminController.getFunnelAnalytics);
adminRouter.get("/leads", adminController.listLeads);
adminRouter.get("/kyc/queue", adminController.listKycQueue);
adminRouter.get("/kyc/:verificationId", adminController.getKycCase);
adminRouter.post("/kyc/:verificationId/approve", adminController.approveKyc);
adminRouter.post("/kyc/:verificationId/reject", adminController.rejectKyc);

export default adminRouter;

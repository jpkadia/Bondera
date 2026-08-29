import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getAdminOverview,
  getAdminOpenAiUsage,
  getAdminSession,
  listAdminAuditLogs,
  listAdminConnections,
  listAdminUsers,
  listPremiumRequests,
  decidePremiumRequest,
  listDeletedMessages,
  logoutAdmin,
  requestAdminLoginOtp,
  toggleUserPremium,
  verifyAdminLoginOtp
} from "../controllers/admin.controller";
import {
  authenticateAdmin,
  requireAdminCsrf
} from "../middleware/authenticateAdmin";
import {
  validateBody,
  validateParams,
  validateQuery
} from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  adminLoginSchema,
  adminPaginationSchema,
  adminUserParamsSchema,
  adminPremiumRequestParamsSchema,
  adminVerifyOtpSchema,
  premiumToggleSchema,
  premiumRequestDecisionSchema
} from "../validation/admin.validation";

export const adminRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "ADMIN_LOGIN_RATE_LIMITED",
    message: "Too many admin login attempts. Please try again later."
  }
});

adminRouter.post(
  "/auth/login",
  adminLoginLimiter,
  validateBody(adminLoginSchema),
  asyncHandler(requestAdminLoginOtp)
);
adminRouter.post(
  "/auth/verify",
  adminLoginLimiter,
  validateBody(adminVerifyOtpSchema),
  asyncHandler(verifyAdminLoginOtp)
);

adminRouter.use(authenticateAdmin);
adminRouter.get("/session", asyncHandler(getAdminSession));
adminRouter.post("/auth/logout", requireAdminCsrf, asyncHandler(logoutAdmin));
adminRouter.get("/overview", asyncHandler(getAdminOverview));
adminRouter.get("/openai-usage", asyncHandler(getAdminOpenAiUsage));
adminRouter.get(
  "/users",
  validateQuery(adminPaginationSchema),
  asyncHandler(listAdminUsers)
);
adminRouter.patch(
  "/users/:userId/premium",
  requireAdminCsrf,
  validateParams(adminUserParamsSchema),
  validateBody(premiumToggleSchema),
  asyncHandler(toggleUserPremium)
);
adminRouter.get(
  "/premium-requests",
  validateQuery(adminPaginationSchema),
  asyncHandler(listPremiumRequests)
);
adminRouter.patch(
  "/premium-requests/:requestId",
  requireAdminCsrf,
  validateParams(adminPremiumRequestParamsSchema),
  validateBody(premiumRequestDecisionSchema),
  asyncHandler(decidePremiumRequest)
);
adminRouter.get(
  "/connections",
  validateQuery(adminPaginationSchema),
  asyncHandler(listAdminConnections)
);
adminRouter.get(
  "/deleted-messages",
  validateQuery(adminPaginationSchema),
  asyncHandler(listDeletedMessages)
);
adminRouter.get(
  "/audit-logs",
  validateQuery(adminPaginationSchema),
  asyncHandler(listAdminAuditLogs)
);

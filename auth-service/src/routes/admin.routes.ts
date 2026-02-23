import { Router } from "express";
import { requireRole } from "../middleware/role.middleware";
import extractUserMiddleware from "../middleware/extract-user.middleware";
import { AdminRepository } from "../repositories/impliments/admin.repository";
import { AdminService } from "../services/impliments/admin.service";
import { AdminController } from "../controllers/implimentation/admin.controller";

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);
const adminController = new AdminController(adminService);

const router = Router();

// HTTP route handlers - clean routes using bind()
// Note: Authentication is handled by API Gateway, which forwards user data via x-user-data header
// We extract the user from the header and then check the role
router
  // get all users
  .get(
    "/users",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getUsers.bind(adminController)
  )

  // block unblock user
  .patch(
    "/users/:id/toggle",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.toogleUserState.bind(adminController)
  )

  // get a specific user
  .get(
    "/user/:id",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getUserFullDetails.bind(adminController)
  )

  // Reporting Routes
  .post(
    "/reports",
    extractUserMiddleware,
    adminController.submitReport.bind(adminController)
  )
  .get(
    "/reports",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getReports.bind(adminController)
  )
  .get(
    "/reports/:id",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getReportById.bind(adminController)
  )
  .patch(
    "/reports/:id/action",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.processReportAction.bind(adminController)
  )
  .post(
    "/reports/bulk-action",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.bulkReportAction.bind(adminController)
  )

  // Audit Logs
  .get(
    "/audit-logs",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getAuditLogs.bind(adminController)
  )

  // Analytics
  .get(
    "/analytics/dashboard",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getDashboardStats.bind(adminController)
  )
  .get(
    "/analytics/reports-by-reason",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getReportsByReason.bind(adminController)
  )
  .get(
    "/analytics/reports-by-severity",
    extractUserMiddleware,
    requireRole("superAdmin"),
    adminController.getReportsBySeverity.bind(adminController)
  )

export default router;

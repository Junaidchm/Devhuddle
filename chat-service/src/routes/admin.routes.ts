import { Router } from "express";
import { AdminController } from "../controllers/impliments/admin.controller";
import { requireAdmin } from "../middleware/admin.middleware";

export const setupAdminRoutes = (adminController: AdminController) => {
  const router = Router();

  // Secure all admin routes
  router.use(requireAdmin);

  router.get(
    "/hubs",
    adminController.getHubs.bind(adminController)
  );

  router.get(
    "/hubs/reported",
    adminController.getReportedHubs.bind(adminController)
  );

  router.get(
    "/hubs/:id",
    adminController.getHubById.bind(adminController)
  );

  router.patch(
    "/hubs/:id/suspend",
    adminController.suspendHub.bind(adminController)
  );

  router.delete(
    "/hubs/:id",
    adminController.deleteHub.bind(adminController)
  );

  return router;
};

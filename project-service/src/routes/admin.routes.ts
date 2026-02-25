import { Router } from "express";
import { AdminController } from "../controllers/impliments/admin.controller";
import { requireAdmin } from "../middleware/admin.middleware";

export const setupAdminRoutes = (adminController: AdminController) => {
  const router = Router();

  // Secure all admin routes
  router.use(requireAdmin);

  router.get(
    "/projects",
    adminController.getProjects.bind(adminController)
  );

  router.get(
    "/projects/reported",
    adminController.getReportedProjects.bind(adminController)
  );

  router.get(
    "/projects/:id",
    adminController.getProjectById.bind(adminController)
  );

  router.patch(
    "/projects/:id/hide",
    adminController.hideProject.bind(adminController)
  );

  router.delete(
    "/projects/:id",
    adminController.deleteProject.bind(adminController)
  );

  return router;
};

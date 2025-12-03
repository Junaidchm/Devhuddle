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
    extractUserMiddleware, // Extract user from x-user-data header
    requireRole("superAdmin"), // Check if user has superAdmin role
    adminController.getUsers.bind(adminController)
  )

  // block unblock user
  .patch(
    "/users/:id/toogle",
    extractUserMiddleware, // Extract user from x-user-data header
    requireRole("superAdmin"), // Check if user has superAdmin role
    adminController.toogleUserState.bind(adminController)
  )

  // get a specific user
  .get(
    "/user/:id",
    extractUserMiddleware, // Extract user from x-user-data header
    requireRole("superAdmin"), // Check if user has superAdmin role
    adminController.getUserFullDetails.bind(adminController)
  )
export default router;

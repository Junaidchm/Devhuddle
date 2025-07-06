import { Router } from "express";
import jwtMiddleware from "../middleware/jwt.middleware";
import { requireRole } from "../middleware/role.middleware";
import { AdminRepository } from "../repositories/impliments/admin.repository";
import { AdminService } from "../services/impliments/admin.service";
import { AdminController } from "../controllers/implimentation/admin.controller";

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);
const adminController = new AdminController(adminService);

const router = Router();

router
  // get all users
  .get(
    "/users",
    jwtMiddleware,
    requireRole("superAdmin"),
    adminController.getUsers.bind(adminController)
  )

  // block unblock user
  .patch(
    "/users/:id/toogle",
    jwtMiddleware,
    requireRole("superAdmin"),
    adminController.toogleUserState.bind(adminController)
  )

  // get a specific user
  .get(
    "/user/:id",
    jwtMiddleware,
    requireRole("superAdmin"),
    adminController.getUserFullDetails.bind(adminController)
  );
export default router;

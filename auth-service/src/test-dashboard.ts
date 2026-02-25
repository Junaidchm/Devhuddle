import { AdminService } from "./services/impliments/admin.service";
import { AdminRepository } from "./repositories/impliments/admin.repository";

async function main() {
  const adminRepo = new AdminRepository();
  const adminService = new AdminService(adminRepo);

  console.log("Fetching dashboard stats...");
  const stats = await adminService.getDashboardStats();
  console.log(JSON.stringify(stats, null, 2));
  process.exit(0);
}

main().catch(console.error);

import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.util";


const prisma = new PrismaClient();

export const connectPrisma = async () => {
  try {
    await prisma.$connect();
    logger.info("Connected to PostgreSQL");
  } catch (error : any) {
    logger.error("Prisma connection error", { error: error.message });
    throw error;
  }
};

export default prisma;
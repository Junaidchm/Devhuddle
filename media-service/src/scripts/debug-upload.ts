
import dotenv from "dotenv";
import path from "path";
// Load env vars from .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { StorageService } from "../services/impliments/storage.service";
import { MediaType } from "@prisma/client";
import { prisma } from "../config/prisma.config";

async function test() {
  console.log("Testing Upload Session Flow...");
  console.log("R2_BUCKET:", process.env.R2_BUCKET_NAME);

  const storage = new StorageService();
  const testKey = "test-profile-image.jpg";

  try {
    // 1. Test Presigned URL
    console.log("Generating presigned URL...");
    const presigned = await storage.generatePresignedPutUrl(testKey, "image/jpeg", { contentLength: 1024 });
    console.log("Presigned URL generated successfully:", presigned.url.substring(0, 50) + "...");

    // 2. Test DB Connection
    console.log("Testing DB connection...");
    // We won't actually create a media record to avoid garbage, but we can count
    const count = await prisma.media.count();
    console.log("DB Connection successful. Media count:", count);

    console.log("SUCCESS");
  } catch (error: any) {
    console.error("FAILURE:", error);
    process.exit(1);
  } finally {
      await prisma.$disconnect();
  }
}

test();

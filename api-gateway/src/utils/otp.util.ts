import {logger} from "./logger";
import redisClient from "../utils/redis.util";

const OTP_EXPIRY_SECONDS = 60;

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = async (email: string, otp: string): Promise<void> => {
  try {
    await redisClient.setEx(`otp:${email}`, OTP_EXPIRY_SECONDS, otp);
    logger.info("OTP stored in Redis", { email });
  } catch (error: unknown) {
    logger.error("Error storing OTP", { error: (error as Error).message });
    throw new Error("Redis error");
  }
};

export const verifyOTP = async (
  email: string,
  otp: string
): Promise<boolean> => {
  try {
    const storedOtp = await redisClient.get(`otp:${email}`);
    if (storedOtp === otp) {
      await redisClient.del(`otp:${email}`);
      logger.info("OTP verified successfully", { email });
      return true;
    }
    logger.warn("Invalid OTP", { email });
    return false;
  } catch (error: unknown) {
    logger.error("Error verifying OTP", { error: (error as Error).message });
    throw new Error("Redis error");
  }
};

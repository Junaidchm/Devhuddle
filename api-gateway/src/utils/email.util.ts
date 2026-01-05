import nodemailer from "nodemailer";
import {logger} from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (
  email: string,
  otp: string
): Promise<void> => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "DevHuddle Email Verification",
      text: `Your OTP is: ${otp}. It expires in 1 minutes.`,
    });
    logger.info("Verification email sent", { email });
  } catch (error: unknown) {
    logger.error("Error sending verification email", { error: (error as Error).message });
    throw new Error("Email sending failed");
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  token: string
): Promise<void> => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "DevHuddle Password Reset",
      text: `Click this link to reset your password: ${resetUrl}. It expires in 1 hour.`,
    });
    logger.info("Password reset email sent", { email });
  } catch (err: unknown) {
    logger.error("Error sending password reset email", { error: (err as Error).message });
    throw new Error("Email sending failed");
  }
};

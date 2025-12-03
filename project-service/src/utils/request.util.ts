import { Request } from "express";
import { CustomError } from "./error.util";
import { HttpStatus } from "../constands/http.status";

export function getUserIdFromRequest(req: Request): string {
  const userData = req.headers["x-user-data"];
  if (!userData) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "User data not found in request");
  }
  
  try {
    const user = typeof userData === "string" ? JSON.parse(userData) : userData;
    if (!user || !user.id) {
      throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid user data: missing user ID");
    }
    return user.id;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid user data format");
  }
}


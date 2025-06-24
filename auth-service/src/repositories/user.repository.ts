import prisma from "../config/prisma.config";
import { ProfileUpdatePayload, User } from "../types/auth";
import logger from "../utils/logger.util";
import { BaseRepository } from "./base.repository";
import bcrypt from "bcrypt";

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByIdUser(id: string): Promise<User | null>;
  createUser(
    email: string,
    username: string,
    name: string,
    password: string
  ): Promise<User>;
  verifyPassword(userPassword: string, password: string): Promise<boolean>;
  updateEmailVerified(email: string, emailVerified: boolean): Promise<User>;
  createOAuthUser(oauthUser: {
    email: string;
    username: string;
    name?: string;
  }): Promise<User>;
  updatePassword(email: string, password: string): Promise<User>;
  updateProfile(userId:string,data:Partial<User>):Promise<User>
}

export class UserRepository
  extends BaseRepository<User>
  implements IUserRepository
{
  constructor() {
    super(prisma, prisma.user);
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.model.findUnique({ where: { email } });
    } catch (error: any) {
      logger.error("Error finding user by email", { error: error.message });
      throw new Error("Database error");
    }
  }

  async findByIdUser(id: string): Promise<User | null> {
    try {
      return await super.findById(id);
    } catch (error: any) {
      logger.error("Error finding user by id", { error: error.message });
      throw new Error("Database error");
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      return await this.model.findUnique({ where: { username } });
    } catch (error: any) {
      logger.error("Error finding user by username", { error: error.message });
      throw new Error("Database error");
    }
  }

  async createUser(
    email: string,
    username: string,
    name: string,
    password: string
  ): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      return await super.create({
        email,
        username,
        name,
        password: hashedPassword,
      });
    } catch (error: any) {
      logger.error("Error creating user", { error: error.message });
      throw new Error("Database error");
    }
  }

  async verifyPassword(
    userPassword: string,
    password: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password,userPassword);
    } catch (error: any) {
      logger.error("Error verifying password", { error: error.message });
      throw new Error("Password verification failed");
    }
  }

  async updateEmailVerified(
    email: string,
    emailVerified: boolean
  ): Promise<User> {
    try {
      return await super.updateWhere({ email }, { emailVerified });
    } catch (err: any) {
      logger.error("Error updating email verification", { error: err.message });
      throw new Error("Database error");
    }
  }

  async updatePassword(email: string, password: string): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      return await super.updateWhere({ email }, { password: hashedPassword });
    } catch (err: any) {
      logger.error("Error updating password", { error: err.message });
      throw new Error("Database error");
    }
  }

  async updateProfile(userId:string,data:Partial<User>) : Promise<User> {
    try {
       return await super.updateWhere({id:userId},data)
    } catch (err:any) {
      logger.error("Error updating Profile", { error: err.message });
      throw new Error("Database error");
    }
  }

  async createOAuthUser({
    email,
    username,
    name,
  }: {
    email: string;
    username: string;
    name?: string;
  }): Promise<User> {
    try {
      return await super.create({ email, username, name, emailVerified: true });
    } catch (err: any) {
      logger.error("Error creating OAuth user", { error: err.message });
      throw new Error("Database error");
    }
  }
}

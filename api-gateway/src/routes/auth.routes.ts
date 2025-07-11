import { Router } from "express";
import express, { Request, Response, NextFunction } from "express";
import * as grpc from "@grpc/grpc-js";
import * as authProto from "../../grpc-generated/auth_pb";
import * as authService from "../../grpc-generated/auth_grpc_pb";
import { grpcCall } from "../utils/grpc.helper";
import { HttpStatus } from "../utils/constents";
import { sendErrorResponse } from "../utils/error.util";


// gRPC routes for other auth endpoints
const router = Router();
router.use(express.json());

router
  .post("/", async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/signup request:", req.body);
    const request = new authProto.RegisterRequest();
    request.setEmail(req.body.email);
    request.setUsername(req.body.username);
    request.setName(req.body.name);
    request.setPassword(req.body.password);
    const response = await grpcCall<authProto.RegisterResponse>(
      "register",
      request
    );
    res.status(HttpStatus.CREATED).json(response.toObject());
  } catch (err: any) {
    console.error("Error in /auth/signup:", err);
    sendErrorResponse(res, {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: err.message || "Server error",
    });
  }
  })
  

export default router;

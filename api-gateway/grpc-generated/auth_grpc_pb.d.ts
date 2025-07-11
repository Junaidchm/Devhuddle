// package: auth
// file: auth.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as auth_pb from "./auth_pb";

interface IAuthServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    register: IAuthServiceService_IRegister;
    verifyOTP: IAuthServiceService_IVerifyOTP;
}

interface IAuthServiceService_IRegister extends grpc.MethodDefinition<auth_pb.RegisterRequest, auth_pb.RegisterResponse> {
    path: "/auth.AuthService/Register";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<auth_pb.RegisterRequest>;
    requestDeserialize: grpc.deserialize<auth_pb.RegisterRequest>;
    responseSerialize: grpc.serialize<auth_pb.RegisterResponse>;
    responseDeserialize: grpc.deserialize<auth_pb.RegisterResponse>;
}
interface IAuthServiceService_IVerifyOTP extends grpc.MethodDefinition<auth_pb.VerifyOTPRequest, auth_pb.VerifyOTPResponse> {
    path: "/auth.AuthService/VerifyOTP";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<auth_pb.VerifyOTPRequest>;
    requestDeserialize: grpc.deserialize<auth_pb.VerifyOTPRequest>;
    responseSerialize: grpc.serialize<auth_pb.VerifyOTPResponse>;
    responseDeserialize: grpc.deserialize<auth_pb.VerifyOTPResponse>;
}

export const AuthServiceService: IAuthServiceService;

export interface IAuthServiceServer {
    register: grpc.handleUnaryCall<auth_pb.RegisterRequest, auth_pb.RegisterResponse>;
    verifyOTP: grpc.handleUnaryCall<auth_pb.VerifyOTPRequest, auth_pb.VerifyOTPResponse>;
}

export interface IAuthServiceClient {
    register(request: auth_pb.RegisterRequest, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    register(request: auth_pb.RegisterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    register(request: auth_pb.RegisterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    verifyOTP(request: auth_pb.VerifyOTPRequest, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
    verifyOTP(request: auth_pb.VerifyOTPRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
    verifyOTP(request: auth_pb.VerifyOTPRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
}

export class AuthServiceClient extends grpc.Client implements IAuthServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public register(request: auth_pb.RegisterRequest, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    public register(request: auth_pb.RegisterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    public register(request: auth_pb.RegisterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: auth_pb.RegisterResponse) => void): grpc.ClientUnaryCall;
    public verifyOTP(request: auth_pb.VerifyOTPRequest, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
    public verifyOTP(request: auth_pb.VerifyOTPRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
    public verifyOTP(request: auth_pb.VerifyOTPRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: auth_pb.VerifyOTPResponse) => void): grpc.ClientUnaryCall;
}

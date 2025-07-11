// package: auth
// file: auth.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class RegisterRequest extends jspb.Message { 
    getEmail(): string;
    setEmail(value: string): RegisterRequest;
    getUsername(): string;
    setUsername(value: string): RegisterRequest;
    getName(): string;
    setName(value: string): RegisterRequest;
    getPassword(): string;
    setPassword(value: string): RegisterRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterRequest): RegisterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RegisterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterRequest;
    static deserializeBinaryFromReader(message: RegisterRequest, reader: jspb.BinaryReader): RegisterRequest;
}

export namespace RegisterRequest {
    export type AsObject = {
        email: string,
        username: string,
        name: string,
        password: string,
    }
}

export class RegisterResponse extends jspb.Message { 
    getMessage(): string;
    setMessage(value: string): RegisterResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterResponse): RegisterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RegisterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterResponse;
    static deserializeBinaryFromReader(message: RegisterResponse, reader: jspb.BinaryReader): RegisterResponse;
}

export namespace RegisterResponse {
    export type AsObject = {
        message: string,
    }
}

export class VerifyOTPRequest extends jspb.Message { 
    getEmail(): string;
    setEmail(value: string): VerifyOTPRequest;
    getOtp(): string;
    setOtp(value: string): VerifyOTPRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): VerifyOTPRequest.AsObject;
    static toObject(includeInstance: boolean, msg: VerifyOTPRequest): VerifyOTPRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: VerifyOTPRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): VerifyOTPRequest;
    static deserializeBinaryFromReader(message: VerifyOTPRequest, reader: jspb.BinaryReader): VerifyOTPRequest;
}

export namespace VerifyOTPRequest {
    export type AsObject = {
        email: string,
        otp: string,
    }
}

export class VerifyOTPResponse extends jspb.Message { 
    getMessage(): string;
    setMessage(value: string): VerifyOTPResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): VerifyOTPResponse.AsObject;
    static toObject(includeInstance: boolean, msg: VerifyOTPResponse): VerifyOTPResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: VerifyOTPResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): VerifyOTPResponse;
    static deserializeBinaryFromReader(message: VerifyOTPResponse, reader: jspb.BinaryReader): VerifyOTPResponse;
}

export namespace VerifyOTPResponse {
    export type AsObject = {
        message: string,
    }
}

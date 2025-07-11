// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var auth_pb = require('./auth_pb.js');

function serialize_auth_RegisterRequest(arg) {
  if (!(arg instanceof auth_pb.RegisterRequest)) {
    throw new Error('Expected argument of type auth.RegisterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_RegisterRequest(buffer_arg) {
  return auth_pb.RegisterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_RegisterResponse(arg) {
  if (!(arg instanceof auth_pb.RegisterResponse)) {
    throw new Error('Expected argument of type auth.RegisterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_RegisterResponse(buffer_arg) {
  return auth_pb.RegisterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_VerifyOTPRequest(arg) {
  if (!(arg instanceof auth_pb.VerifyOTPRequest)) {
    throw new Error('Expected argument of type auth.VerifyOTPRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_VerifyOTPRequest(buffer_arg) {
  return auth_pb.VerifyOTPRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_VerifyOTPResponse(arg) {
  if (!(arg instanceof auth_pb.VerifyOTPResponse)) {
    throw new Error('Expected argument of type auth.VerifyOTPResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_VerifyOTPResponse(buffer_arg) {
  return auth_pb.VerifyOTPResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var AuthServiceService = exports.AuthServiceService = {
  // User-related methods
register: {
    path: '/auth.AuthService/Register',
    requestStream: false,
    responseStream: false,
    requestType: auth_pb.RegisterRequest,
    responseType: auth_pb.RegisterResponse,
    requestSerialize: serialize_auth_RegisterRequest,
    requestDeserialize: deserialize_auth_RegisterRequest,
    responseSerialize: serialize_auth_RegisterResponse,
    responseDeserialize: deserialize_auth_RegisterResponse,
  },
  verifyOTP: {
    path: '/auth.AuthService/VerifyOTP',
    requestStream: false,
    responseStream: false,
    requestType: auth_pb.VerifyOTPRequest,
    responseType: auth_pb.VerifyOTPResponse,
    requestSerialize: serialize_auth_VerifyOTPRequest,
    requestDeserialize: deserialize_auth_VerifyOTPRequest,
    responseSerialize: serialize_auth_VerifyOTPResponse,
    responseDeserialize: deserialize_auth_VerifyOTPResponse,
  },
};

exports.AuthServiceClient = grpc.makeGenericClientConstructor(AuthServiceService, 'AuthService');

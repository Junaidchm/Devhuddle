// Original file: protos/user.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CheckFollowRequest as _CheckFollowRequest, CheckFollowRequest__Output as _CheckFollowRequest__Output } from './CheckFollowRequest';
import type { CheckFollowResponse as _CheckFollowResponse, CheckFollowResponse__Output as _CheckFollowResponse__Output } from './CheckFollowResponse';
import type { GetFollowersRequest as _GetFollowersRequest, GetFollowersRequest__Output as _GetFollowersRequest__Output } from './GetFollowersRequest';
import type { GetFollowersResponse as _GetFollowersResponse, GetFollowersResponse__Output as _GetFollowersResponse__Output } from './GetFollowersResponse';
import type { GetUserProfilesRequest as _GetUserProfilesRequest, GetUserProfilesRequest__Output as _GetUserProfilesRequest__Output } from './GetUserProfilesRequest';
import type { GetUserProfilesResponse as _GetUserProfilesResponse, GetUserProfilesResponse__Output as _GetUserProfilesResponse__Output } from './GetUserProfilesResponse';
import type { getUserForFeedListingRequest as _getUserForFeedListingRequest, getUserForFeedListingRequest__Output as _getUserForFeedListingRequest__Output } from './getUserForFeedListingRequest';
import type { getUserForFeedListingResponse as _getUserForFeedListingResponse, getUserForFeedListingResponse__Output as _getUserForFeedListingResponse__Output } from './getUserForFeedListingResponse';

export interface UserServiceClient extends grpc.Client {
  CheckFollow(argument: _CheckFollowRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  CheckFollow(argument: _CheckFollowRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  CheckFollow(argument: _CheckFollowRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  CheckFollow(argument: _CheckFollowRequest, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  checkFollow(argument: _CheckFollowRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  checkFollow(argument: _CheckFollowRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  checkFollow(argument: _CheckFollowRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  checkFollow(argument: _CheckFollowRequest, callback: grpc.requestCallback<_CheckFollowResponse__Output>): grpc.ClientUnaryCall;
  
  GetFollowers(argument: _GetFollowersRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  GetFollowers(argument: _GetFollowersRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  GetFollowers(argument: _GetFollowersRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  GetFollowers(argument: _GetFollowersRequest, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  getFollowers(argument: _GetFollowersRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  getFollowers(argument: _GetFollowersRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  getFollowers(argument: _GetFollowersRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  getFollowers(argument: _GetFollowersRequest, callback: grpc.requestCallback<_GetFollowersResponse__Output>): grpc.ClientUnaryCall;
  
  GetUserProfiles(argument: _GetUserProfilesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  GetUserProfiles(argument: _GetUserProfilesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  GetUserProfiles(argument: _GetUserProfilesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  GetUserProfiles(argument: _GetUserProfilesRequest, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  getUserProfiles(argument: _GetUserProfilesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  getUserProfiles(argument: _GetUserProfilesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  getUserProfiles(argument: _GetUserProfilesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  getUserProfiles(argument: _GetUserProfilesRequest, callback: grpc.requestCallback<_GetUserProfilesResponse__Output>): grpc.ClientUnaryCall;
  
  getUserForFeedListing(argument: _getUserForFeedListingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_getUserForFeedListingResponse__Output>): grpc.ClientUnaryCall;
  getUserForFeedListing(argument: _getUserForFeedListingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_getUserForFeedListingResponse__Output>): grpc.ClientUnaryCall;
  getUserForFeedListing(argument: _getUserForFeedListingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_getUserForFeedListingResponse__Output>): grpc.ClientUnaryCall;
  getUserForFeedListing(argument: _getUserForFeedListingRequest, callback: grpc.requestCallback<_getUserForFeedListingResponse__Output>): grpc.ClientUnaryCall;
  
}

export interface UserServiceHandlers extends grpc.UntypedServiceImplementation {
  CheckFollow: grpc.handleUnaryCall<_CheckFollowRequest__Output, _CheckFollowResponse>;
  
  GetFollowers: grpc.handleUnaryCall<_GetFollowersRequest__Output, _GetFollowersResponse>;
  
  GetUserProfiles: grpc.handleUnaryCall<_GetUserProfilesRequest__Output, _GetUserProfilesResponse>;
  
  getUserForFeedListing: grpc.handleUnaryCall<_getUserForFeedListingRequest__Output, _getUserForFeedListingResponse>;
  
}

export interface UserServiceDefinition extends grpc.ServiceDefinition {
  CheckFollow: MethodDefinition<_CheckFollowRequest, _CheckFollowResponse, _CheckFollowRequest__Output, _CheckFollowResponse__Output>
  GetFollowers: MethodDefinition<_GetFollowersRequest, _GetFollowersResponse, _GetFollowersRequest__Output, _GetFollowersResponse__Output>
  GetUserProfiles: MethodDefinition<_GetUserProfilesRequest, _GetUserProfilesResponse, _GetUserProfilesRequest__Output, _GetUserProfilesResponse__Output>
  getUserForFeedListing: MethodDefinition<_getUserForFeedListingRequest, _getUserForFeedListingResponse, _getUserForFeedListingRequest__Output, _getUserForFeedListingResponse__Output>
}

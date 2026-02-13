/**
 * Video Call Types for WebRTC Signaling
 */

export type CallState = 'IDLE' | 'INCOMING' | 'CALLING' | 'CONNECTED' | 'ENDED';

export interface CallParticipant {
  userId: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSharingScreen: boolean;
  joinedAt: Date;
}

export interface ActiveCall {
  conversationId: string;
  initiatorId: string;
  participants: Map<string, CallParticipant>;
  startedAt: Date;
}

// ==================== WebSocket Call Message Types ====================

export interface CallStartPayload {
  type: 'call:start';
  conversationId: string;
  isVideoCall: boolean; // true for video, false for audio-only
}

export interface CallJoinPayload {
  type: 'call:join';
  conversationId: string;
}

export interface CallSignalPayload {
  type: 'call:signal';
  conversationId: string;
  targetUserId: string; // Who should receive this signal
  signalType: 'offer' | 'answer' | 'ice-candidate';
  signalData: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface CallLeavePayload {
  type: 'call:leave';
  conversationId: string;
}

export interface CallEndPayload {
  type: 'call:end';
  conversationId: string;
  reason?: string;
}

export interface CallToggleMediaPayload {
  type: 'call:toggle_media';
  conversationId: string;
  mediaType: 'audio' | 'video' | 'screen';
  isEnabled: boolean;
}

export type CallMessage =
  | CallStartPayload
  | CallJoinPayload
  | CallSignalPayload
  | CallLeavePayload
  | CallEndPayload
  | CallToggleMediaPayload;

// ==================== Server -> Client Events ====================

export interface CallIncomingEvent {
  type: 'call:incoming';
  conversationId: string;
  callerId: string;
  callerName: string;
  isVideoCall: boolean;
  participants: string[]; // All userIds currently in call
}

export interface CallParticipantJoinedEvent {
  type: 'call:participant_joined';
  conversationId: string;
  userId: string;
}

export interface CallParticipantLeftEvent {
  type: 'call:participant_left';
  conversationId: string;
  userId: string;
}

export interface CallEndedEvent {
  type: 'call:ended';
  conversationId: string;
  reason?: string;
}

export interface CallMediaToggledEvent {
  type: 'call:media_toggled';
  conversationId: string;
  userId: string;
  mediaType: 'audio' | 'video' | 'screen';
  isEnabled: boolean;
}

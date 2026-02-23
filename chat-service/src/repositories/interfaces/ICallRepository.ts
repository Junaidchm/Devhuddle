import { Call, CallParticipant, CallType, CallMediaType, CallStatus, CallParticipantStatus } from "@prisma/client";

export interface ICallRepository {
  createCall(
    conversationId: string,
    callerId: string,
    type: CallType,
    callType: CallMediaType,
    participantIds: string[]
  ): Promise<Call & { participants: CallParticipant[] }>;

  getCallById(callId: string): Promise<(Call & { participants: CallParticipant[] }) | null>;

  updateCallStatus(callId: string, status: CallStatus): Promise<Call>;

  updateParticipantStatus(
    callId: string,
    userId: string,
    status: CallParticipantStatus
  ): Promise<CallParticipant>;

  endCall(callId: string): Promise<Call>;
}

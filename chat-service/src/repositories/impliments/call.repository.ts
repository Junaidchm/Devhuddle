import { Call, CallParticipant, CallType, CallMediaType, CallStatus, CallParticipantStatus } from "@prisma/client";
import prisma from "../../config/db";
import { ICallRepository } from "../interfaces/ICallRepository";
import logger from "../../utils/logger.util";

export class CallRepository implements ICallRepository {
  async createCall(
    conversationId: string,
    callerId: string,
    type: CallType,
    callType: CallMediaType,
    participantIds: string[]
  ): Promise<Call & { participants: CallParticipant[] }> {
    try {
      const allParticipantIds = Array.from(new Set([callerId, ...participantIds]));
      
      return await prisma.call.create({
        data: {
          conversationId,
          callerId,
          type,
          callType,
          status: 'RINGING',
          participants: {
            create: allParticipantIds.map(id => ({
              userId: id,
              status: id === callerId ? 'JOINED' : 'INVITED',
              joinedAt: id === callerId ? new Date() : null
            }))
          }
        },
        include: {
          participants: true
        }
      });
    } catch (error) {
      logger.error("Error creating call in DB", { error: (error as Error).message, conversationId, callerId });
      throw new Error("Database error");
    }
  }

  async getCallById(callId: string): Promise<(Call & { participants: CallParticipant[] }) | null> {
    try {
      return await prisma.call.findUnique({
        where: { id: callId },
        include: { participants: true }
      });
    } catch (error) {
      logger.error("Error fetching call by id", { error: (error as Error).message, callId });
      throw new Error("Database error");
    }
  }

  async updateCallStatus(callId: string, status: CallStatus): Promise<Call> {
    try {
      return await prisma.call.update({
        where: { id: callId },
        data: { 
            status,
            endedAt: status === 'ENDED' ? new Date() : undefined
        }
      });
    } catch (error) {
      logger.error("Error updating call status", { error: (error as Error).message, callId });
      throw new Error("Database error");
    }
  }

  async updateParticipantStatus(
    callId: string,
    userId: string,
    status: CallParticipantStatus
  ): Promise<CallParticipant> {
    try {
      const updateData: any = { status };
      
      if (status === 'JOINED') {
          updateData.joinedAt = new Date();
      } else if (status === 'LEFT' || status === 'DECLINED') {
          updateData.leftAt = new Date();
      }

      return await prisma.callParticipant.update({
        where: {
          callId_userId: { callId, userId }
        },
        data: updateData
      });
    } catch (error) {
      logger.error("Error updating call participant status", { error: (error as Error).message, callId, userId });
      throw new Error("Database error");
    }
  }

  async endCall(callId: string): Promise<Call> {
    try {
      // Mark call as ended and all active participants as left
      await prisma.callParticipant.updateMany({
        where: {
            callId,
            status: { in: ['JOINED', 'RINGING', 'INVITED'] }
        },
        data: {
            status: 'LEFT',
            leftAt: new Date()
        }
      });

      return await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'ENDED',
          endedAt: new Date()
        }
      });
    } catch (error) {
      logger.error("Error ending call in DB", { error: (error as Error).message, callId });
      throw new Error("Database error");
    }
  }
}

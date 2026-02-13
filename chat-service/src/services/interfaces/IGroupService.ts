import { Conversation, Participant } from "@prisma/client";
import { ConversationWithMetadataDto } from "../../dtos/chat-service.dto";

export interface IGroupService {
  createGroup(
    creatorId: string, 
    name: string, 
    participantIds: string[], 
    icon?: string,
    onlyAdminsCanPost?: boolean,
    onlyAdminsCanEditInfo?: boolean,
    topics?: string[]
  ): Promise<ConversationWithMetadataDto>;

  getAllGroups(
    query?: string,
    topics?: string[],
    limit?: number,
    offset?: number
  ): Promise<ConversationWithMetadataDto[]>;

  getGroupDetails(groupId: string): Promise<Conversation & { participants: Participant[] }>;
  addParticipants(groupId: string, adminId: string, userIds: string[]): Promise<void>;
  removeParticipant(groupId: string, adminId: string, targetUserId: string): Promise<void>;
  promoteToAdmin(groupId: string, adminId: string, targetUserId: string): Promise<void>;
  demoteToMember(groupId: string, adminId: string, targetUserId: string): Promise<void>;
  updateGroupInfo(
    groupId: string, 
    adminId: string, 
    data: { 
      name?: string; 
      description?: string; 
      icon?: string;
      onlyAdminsCanPost?: boolean;
      onlyAdminsCanEditInfo?: boolean;
    }
  ): Promise<Conversation>;
  leaveGroup(groupId: string, userId: string): Promise<void>;
  joinGroup(groupId: string, userId: string): Promise<void>; // Self-join for public groups
}

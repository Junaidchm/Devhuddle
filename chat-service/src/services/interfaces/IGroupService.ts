import { Conversation, Participant } from "@prisma/client";
import { ConversationWithMetadataDto, GroupListDto, PaginatedGroupsDto, PaginatedGroupListDto } from "../../dtos/chat-service.dto";

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
  ): Promise<PaginatedGroupsDto>;

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
  joinGroup(groupId: string, userId: string): Promise<{ status: 'JOINED' | 'REQUEST_PENDING' }>; // Self-join for public groups

  getMyGroups(
    userId: string,
    query?: string,
    limit?: number,
    offset?: number
  ): Promise<PaginatedGroupListDto>;

  getDiscoverGroups(
    userId: string,
    query?: string,
    topics?: string[],
    limit?: number,
    offset?: number
  ): Promise<PaginatedGroupListDto>;

  getGroupTopics(limit?: number): Promise<{ topic: string, count: number }[]>;
}

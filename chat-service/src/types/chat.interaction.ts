// gRPC request/response types
export interface GetChatStatsRequest {
  user_id: string;
  partner_ids: string[];
  days_back: number;
}

export interface ChatInteraction {
  partner_id: string;
  last_message_at: string;
  message_count: number;
  user_sent_count: number;
  partner_sent_count: number;
  response_rate: number;
  days_since_last_message: number;
}

export interface GetChatStatsResponse {
  interactions: ChatInteraction[];
}

export interface GetRecentPartnersRequest {
  user_id: string;
  limit: number;
  days_back: number;
}

export interface GetRecentPartnersResponse {
  partner_ids: string[];
}
/**
 * Response DTO for a single chat suggestion user
 * LinkedIn-style: Simple and clean (photo, name, skills only)
 */
export interface ChatSuggestionDto {
  id: string;
  username: string;
  fullName: string;
  profilePhoto?: string;
  bio?: string;
  skills?: string[];
}

/**
 * Response DTO for chat suggestions list
 */
export interface ChatSuggestionsResponseDto {
  suggestions: ChatSuggestionDto[];
  total: number;
}

/**
 * Media Service HTTP Client
 * 
 * This client communicates with the Media Service (HTTP REST API)
 * to validate media ownership and link media to projects.
 */

import logger from "../utils/logger.util";

const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || "http://media-service:5003";

export interface MediaValidationResponse {
  valid: boolean;
  invalidMediaIds?: string[];
  message?: string;
  validMedia?: any[];
}

/**
 * Validate that media belongs to the user and is not already linked
 */
export async function validateMediaOwnership(
  mediaIds: string[],
  userId: string
): Promise<MediaValidationResponse> {
  try {
    const response = await fetch(`${MEDIA_SERVICE_URL}/api/v1/media/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaIds,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Validation failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error: any) {
    logger.error("Media Service validation failed:", { error: error.message });
    throw new Error(`Media validation failed: ${error.message}`);
  }
}

/**
 * Link media to a project in the Media Service
 */
export async function linkMediaToProject(
  mediaIds: string[],
  projectId: string,
  userId: string
): Promise<void> {
  try {
    const response = await fetch(`${MEDIA_SERVICE_URL}/api/v1/media/link-to-project`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaIds,
        projectId,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Linking failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
  } catch (error: any) {
    logger.error("Failed to link media to project:", { error: error.message });
    throw new Error(`Failed to link media: ${error.message}`);
  }
}

/**
 * Fetch media associated with a project
 * 
 * Used for displaying media on project details pages.
 */
export async function fetchProjectMedia(projectId: string): Promise<any[]> {
  try {
    const response = await fetch(`${MEDIA_SERVICE_URL}/media/project/${projectId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      const error = await response.json().catch(() => ({ message: "Fetch failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error: any) {
    logger.error(`Failed to fetch media for project ${projectId}:`, { error: error.message });
    throw error;
  }
}

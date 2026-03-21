import { Kafka } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import { IChatRepository } from "../repositories/interfaces/IChatRepository";
import { MessageSagaService } from "../services/impliments/message.service";
import { authServiceClient } from "../clients/auth-service.client";
import { RedisCacheService } from "../utils/redis-cache.util";

/**
 * Consumer for Hub Activation tasks (e.g., adding user to group after approval)
 */
export async function startHubActivationConsumer(
  chatRepository: IChatRepository,
  messageSagaService: MessageSagaService
): Promise<void> {
  const kafka = new Kafka(KAFKA_CONFIG);
  const consumer = kafka.consumer({ groupId: "chat-service-hub-activation" });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: KAFKA_TOPICS.CHAT_EVENTS, 
    fromBeginning: false 
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const eventType = message.headers?.["event-type"]?.toString();
      if (eventType !== "HubJoinApproved") return;

      const rawValue = message.value?.toString();
      if (!rawValue) return;

      let event: any;
      try {
        event = JSON.parse(rawValue);
      } catch {
        logger.error("HubActivationConsumer: Failed to parse event", { rawValue });
        return;
      }

      const { hubId, requesterId, resolvedBy } = event;

      try {
        logger.info(`Activating membership for user ${requesterId} in hub ${hubId}`);

        // 1. Ensure participant is active (Idempotent upsert)
        const { wasAlreadyActive } = await chatRepository.ensureParticipantActive(hubId, requesterId);

        if (wasAlreadyActive) {
          logger.info(`User ${requesterId} already an active member in hub ${hubId}. Skipping side-effects.`);
          return;
        }

        logger.info(`Membership activated for user ${requesterId} in hub ${hubId}. Proceeding with side-effects.`);

        // 2. Invalidate hub-specific cache
        await RedisCacheService.invalidateConversationCache(hubId);

        // Fetch FRESH conversation with updated participants for cache invalidation
        const freshConversation = await chatRepository.findConversationById(hubId);
        if (freshConversation) {
          const allActiveParticipantIds = freshConversation.participants
            .filter(p => !p.deletedAt)
            .map(p => p.userId);

          // ✅ CRITICAL FIX: Invalidate the conversation LIST cache for EVERY participant.
          // This prevents "state poisoning" where the UI refetches but gets 2-minute old cached list data.
          logger.info(`Invalidating list caches for ${allActiveParticipantIds.length} participants in hub ${hubId}`);
          for (const userId of allActiveParticipantIds) {
            await RedisCacheService.invalidateUserConversationsMetadataCache(userId);
            await RedisCacheService.invalidateUserConversationsCache(userId);
          }
        }

        // 3. Enrich profile and send system message
        const userProfilesMap = await authServiceClient.getUserProfiles([requesterId]);
        const userProfile = userProfilesMap.get(requesterId);
        const snapshotName = userProfile?.name || userProfile?.username || 'Unknown User';

        await messageSagaService.sendSystemMessage(
          hubId,
          `joined_group:${JSON.stringify({ id: requesterId, name: snapshotName })}`,
          requesterId
        );

        // 4. Update member count
        const newMemberCount = await chatRepository.updateMemberCount(hubId, 1);

        logger.info(`Membership activation complete for user ${requesterId} in hub ${hubId}. New count: ${newMemberCount}`);

        // TODO: Emit HubMemberAdded if needed for other services
      } catch (err: any) {
        logger.error("HubActivationConsumer: Failed to activate membership", {
          hubId,
          requesterId,
          error: err.message
        });
        // In a real Saga, we might emit a failure event here if we had compensatory actions
      }
    },
  });

  logger.info("HubActivationConsumer started and listening for approved requests");
}

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

        // 1. Check if already a member (Idempotency)
        const existing = await chatRepository.findParticipantInConversation(requesterId, hubId);
        if (existing) {
          logger.warn(`User ${requesterId} is already a member of ${hubId}. Skipping activation.`);
          return;
        }

        // 2. Add user to group
        await chatRepository.addParticipantToGroup(hubId, requesterId);

        // 3. Invalidate cache
        await RedisCacheService.invalidateConversationCache(hubId);

        // 4. Enrich profile and send system message
        const userProfilesMap = await authServiceClient.getUserProfiles([requesterId]);
        const userProfile = userProfilesMap.get(requesterId);
        const snapshotName = userProfile?.name || userProfile?.username || 'Unknown User';

        await messageSagaService.sendSystemMessage(
          hubId,
          `joined_group:${JSON.stringify({ id: requesterId, name: snapshotName })}`,
          requesterId
        );

        // 5. Update member count
        const newMemberCount = await chatRepository.updateMemberCount(hubId, 1);

        logger.info(`Membership activated for user ${requesterId} in hub ${hubId}. New count: ${newMemberCount}`);

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

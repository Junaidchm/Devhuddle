// import { Kafka, Producer, Consumer } from "kafkajs";
// import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
// import { v4 as uuidv4 } from "uuid";
// import logger from "./logger.util";

// let producer: Producer | null = null;
// let consumer: Consumer | null = null;

// // export async function getProducer(): Promise<Producer> {
// //   if (!producer) {
// //     const kafka = new Kafka(KAFKA_CONFIG);
// //     producer = kafka.producer({
// //       retry: { initialRetryTime: 100, retries: 5 }, // Exponential backoff (industrial: resilient to flakes)
// //       allowAutoTopicCreation: false, // Explicit topics
// //     });
// //     await producer.connect();
// //     logger.info('Kafka producer connected');
// //   }
// //   return producer;
// // }

// export async function getProducer(): Promise<Producer> {
//   if (!producer) {
//     const kafka = new Kafka(KAFKA_CONFIG);
//     producer = kafka.producer({
//       retry: {
//         initialRetryTime: 100,
//         retries: 5,
//         maxRetryTime: 30000,
//         restartOnFailure: async (err: Error) => {
//           logger.error("Kafka producer restart on failure", {
//             error: err.message,
//           });
//           return true; // Always attempt to restart on failure
//         },
//       },
//       allowAutoTopicCreation: false,
//       idempotent: true, // Ensure exactly-once semantics
//     });
//     await producer.connect();
//     logger.info("Kafka producer connected");
//   }

//   return producer;
// }

// export async function getConsumer(groupId: string): Promise<Consumer> {
//   if (!consumer) {
//     const kafka = new Kafka(KAFKA_CONFIG);
//     consumer = kafka.consumer({
//       groupId,
//       sessionTimeout: 30000,
//       heartbeatInterval: 3000,
//       maxWaitTimeInMs: 5000,
//     });
//     await consumer.connect();
//     logger.info(`Kafka consumer connected with group: ${groupId}`);
//   }
//   return consumer;
// }

// /**
//  * Enhanced event publishing with retry logic and metadata
//  */

// export async function publishEvent(
//   topic: string,
//   event: any,
//   dedupeId?: string,
//   retryCount: number = 0
// ) {
//   const maxRetries = 3;
//   const baseDelay = 1000;

//   try {
//     const producer = await getProducer();
//     const eventWithMetadata = {
//       ...event,
//       dedupeId: dedupeId || uuidv4(),
//       timestamp: new Date().toISOString(),
//       source: "auth-service",
//       version: event.version ?? 1, // Use event's version, or default to a number
//       retryCount,
//     };

//     await producer.send({
//       topic,
//       messages: [
//         {
//           key: event.recipientId || event.followingId || event.followerId,
//           value: JSON.stringify(eventWithMetadata),
//           headers: {
//             "event-type": topic,
//             "dedupe-id": eventWithMetadata.dedupeId,
//             source: "auth-service",
//           },
//         },
//       ],
//     });

//     logger.info(`Event published successfully`, {
//       topic,
//       dedupeId: eventWithMetadata.dedupeId,
//       retryCount,
//     });
//   } catch (error: any) {
//     logger.error(`Failed to publish event`, {
//       topic,
//       error: error.message,
//       retryCount,
//     });

//     if (retryCount < maxRetries) {
//       const delay = baseDelay * Math.pow(2, retryCount);
//       logger.info(`Retrying event publication in ${delay}ms`, {
//         topic,
//         retryCount: retryCount + 1,
//       });
//       setTimeout(() => {
//         publishEvent(topic, event, dedupeId, retryCount + 1);
//       }, delay);
//     } else {
//       // Send to DLQ after max retries
//       await publishToDLQ(topic, event, error.message);
//     }
//   }
// }
// // Reusable publish (fire-and-forget, with dedupeId for idempotency)
// // export async function publishEvent(
// //   topic: string,
// //   event: any,
// //   dedupeId?: string
// // ): Promise<void> {
// //   const producer = await getProducer();
// //   const payload = {
// //     ...event,
// //     dedupeId: dedupeId || Date.now().toString(),
// //     timestamp: Date.now(),
// //   };

// //   try {
// //     await producer.send({
// //       topic,
// //       messages: [{ value: JSON.stringify(payload) }],
// //     });
// //     logger.info(`Published to ${topic}:`, payload);
// //   } catch (error) {
// //     logger.error(`Publish failed for ${topic}:`, error);
// //     // DLQ: Send to dead-letter topic (e.g., `${topic}-dlq`)
// //     await producer.send({
// //       topic: `${topic}-dlq`,
// //       messages: [{ value: JSON.stringify(payload) }],
// //     });
// //     throw error; // Bubble up for saga compensating if critical
// //   }
// // }

// // export async function getConsumer(groupId: string): Promise<Consumer> {
// //   if (!consumer) {
// //     const kafka = new Kafka(KAFKA_CONFIG);
// //     consumer = kafka.consumer({ groupId }); // Per-topic group for scaling
// //     await consumer.connect();
// //     logger.info(`Kafka consumer connected for group ${groupId}`);
// //   }
// //   return consumer;
// // }

// /**
//  * Publish failed events to Dead Letter Queue
//  */

// async function publishToDLQ(
//   originalTopic: string,
//   event: any,
//   errorMessage: string
// ): Promise<void> {
//   try {
//     const dlqTopic = `${originalTopic}-dlq`;
//     const dlqEvent = {
//       ...event,
//       originalTopic,
//       errorMessage,
//       dlqTimestamp: new Date().toISOString(),
//       dlqReason: "max_retries_exceeded",
//     };

//     const producer = await getProducer();
//     await producer.send({
//       topic: dlqTopic,
//       messages: [
//         {
//           key: event.recipientId || event.followingId || event.followerId,
//           value: JSON.stringify(dlqEvent),
//           headers: {
//             "event-type": dlqTopic,
//             "original-topic": originalTopic,
//             "dlq-reason": "max_retries_exceeded",
//           },
//         },
//       ],
//     });

//     logger.error(`Event sent to DLQ`, {
//       originalTopic,
//       dlqTopic,
//       errorMessage,
//     });
//   } catch (dlqError: any) {
//     logger.error(`Failed to send event to DLQ`, {
//       originalTopic,
//       dlqError: dlqError.message,
//     });
//   }
// }

// // Graceful shutdown (reusable in index.ts)
// export async function shutdownKafka(): Promise<void> {
//   if (producer) await producer.disconnect();
//   if (consumer) await consumer.disconnect();
//   logger.info("Kafka disconnected");
// }

import { Kafka, Producer, Consumer } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";
import { v4 as uuidv4 } from "uuid";

let producer: Producer | null = null;
const consumers: Map<string, Consumer> = new Map();

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    producer = kafka.producer({
      retry: {
        initialRetryTime: 100,
        retries: 5,
        maxRetryTime: 30000,
        restartOnFailure: async (err: Error) => {
          logger.error("Kafka producer restart on failure", {
            error: err.message,
          });
          return true; // Always attempt to restart on failure
        },
      },
      allowAutoTopicCreation: false,
      idempotent: true,
    });
    await producer.connect();
    logger.info("Kafka producer connected");
  }
  return producer;
}

export async function getConsumer(groupId: string): Promise<Consumer> {
  let consumer = consumers.get(groupId);
  if (!consumer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
    });
    await consumer.connect();
    consumers.set(groupId, consumer);
    logger.info(`Kafka consumer connected with group: ${groupId}`);
  }
  return consumer;
}

/**
 * Enhanced event publishing with retry logic and metadata
 */
export async function publishEvent(
  topic: string,
  event: any,
  dedupeId?: string,
  retryCount: number = 0
): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000;

  try {
    const producer = await getProducer();
    const eventWithMetadata = {
      ...event,
      dedupeId: dedupeId || uuidv4(),
      timestamp: new Date().toISOString(),
      source: "notification-service",
      version: event.version ?? 1,
      retryCount,
    };

    console.log('the event is publication -------------------->')

    await producer.send({
      topic,
      messages: [
        {
          key: event.recipientId || event.followingId || event.followerId,
          value: JSON.stringify(eventWithMetadata),
          headers: {
            "event-type": topic,
            "dedupe-id": eventWithMetadata.dedupeId,
            source: "notification-service",
          },
        },
      ],
    });

    logger.info(`Event published successfully`, {
      topic,
      dedupeId: eventWithMetadata.dedupeId,
      retryCount,
    });
  } catch (error: any) {
    logger.error(`Failed to publish event`, {
      topic,
      error: error.message,
      retryCount,
    });

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.info(`Retrying event publication in ${delay}ms`, {
        topic,
        retryCount: retryCount + 1,
      });

      setTimeout(() => {
        publishEvent(topic, event, dedupeId, retryCount + 1);
      }, delay);
    } else {
      // Send to DLQ after max retries
      await publishToDLQ(topic, event, error.message);
    }
  }
}

/**
 * Publish compensation events for Saga pattern
 */
export async function publishCompensationEvent(
  originalEvent: any,
  compensationReason: string
): Promise<void> {
  try {
    const compensationEvent = {
      ...originalEvent,
      compensationReason,
      compensationTimestamp: new Date().toISOString(),
      originalDedupeId: originalEvent.dedupeId,
    };

    await publishEvent(KAFKA_TOPICS.NOTIFICATION_FAILED, compensationEvent);
    logger.info(`Compensation event published`, {
      originalDedupeId: originalEvent.dedupeId,
      compensationReason,
    });
  } catch (error: any) {
    logger.error(`Failed to publish compensation event`, {
      error: error.message,
      originalEvent,
    });
  }
}

/**
 * Publish failed events to Dead Letter Queue
 */
async function publishToDLQ(
  originalTopic: string,
  event: any,
  errorMessage: string
): Promise<void> {
  try {
    const dlqTopic = `${originalTopic}-dlq`;
    const dlqEvent = {
      ...event,
      originalTopic,
      errorMessage,
      dlqTimestamp: new Date().toISOString(),
      dlqReason: "max_retries_exceeded",
    };

    const producer = await getProducer();
    await producer.send({
      topic: dlqTopic,
      messages: [
        {
          key: event.recipientId || event.followingId || event.followerId,
          value: JSON.stringify(dlqEvent),
          headers: {
            "event-type": dlqTopic,
            "original-topic": originalTopic,
            "dlq-reason": "max_retries_exceeded",
          },
        },
      ],
    });

    logger.error(`Event sent to DLQ`, {
      originalTopic,
      dlqTopic,
      errorMessage,
    });
  } catch (dlqError: any) {
    logger.error(`Failed to send event to DLQ`, {
      originalTopic,
      dlqError: dlqError.message,
    });
  }
}

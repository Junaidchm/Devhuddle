import { Kafka, Producer, Consumer } from 'kafkajs';
import { KAFKA_CONFIG, KAFKA_TOPICS } from '../config/kafka.config';
import logger from './logger.util';

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    producer = kafka.producer({
      retry: { initialRetryTime: 100, retries: 5 }, // Exponential backoff (industrial: resilient to flakes)
      allowAutoTopicCreation: false, // Explicit topics
    });
    await producer.connect();
    logger.info('Kafka producer connected');
  }
  return producer;
}

// Reusable publish (fire-and-forget, with dedupeId for idempotency)
export async function publishEvent(topic: string, event: any, dedupeId?: string): Promise<void> {
  const producer = await getProducer();
  const payload = { ...event, dedupeId: dedupeId || Date.now().toString(), timestamp: Date.now() };
  
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    logger.info(`Published to ${topic}:`, payload);
  } catch (error) {
    logger.error(`Publish failed for ${topic}:`, error);
    // DLQ: Send to dead-letter topic (e.g., `${topic}-dlq`)
    await producer.send({ topic: `${topic}-dlq`, messages: [{ value: JSON.stringify(payload) }] });
    throw error; // Bubble up for saga compensating if critical
  }
}

export async function getConsumer(groupId: string): Promise<Consumer> {
  if (!consumer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    consumer = kafka.consumer({ groupId }); // Per-topic group for scaling
    await consumer.connect();
    logger.info(`Kafka consumer connected for group ${groupId}`);
  }
  return consumer;
}

// Graceful shutdown (reusable in index.ts)
export async function shutdownKafka(): Promise<void> {
  if (producer) await producer.disconnect();
  if (consumer) await consumer.disconnect();
  logger.info('Kafka disconnected');
}
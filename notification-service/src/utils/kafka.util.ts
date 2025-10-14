import { Kafka, Producer, Consumer, logLevel } from "kafkajs";
import { KAFKA_CONFIG } from "../config/kafka.config";
import logger from "../utils/logger.util";

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  const kafka = new Kafka({
    ...KAFKA_CONFIG,
    logLevel: logLevel.NOTHING, // change if you want more logs
  });
  producer = kafka.producer({
    allowAutoTopicCreation: false,
    retry: { initialRetryTime: 100, retries: 5 },
  });
  await producer.connect();
  logger?.info?.("Kafka producer connected");
  return producer;
}

export async function publishEvent(topic: string, event: any): Promise<void> {
  const p = await getProducer();
  const payload = {
    value: JSON.stringify({
      ...event,
      dedupeId: event.dedupeId ?? `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }),
  };
  try {
    await p.send({ topic, messages: [payload] });
    logger?.info?.(`Published event to ${topic}`);
  } catch (err) {
    logger?.error?.('publishEvent error', err);
    // simple DLQ attempt (best-effort). In production you might escalate.
    try {
      await p.send({ topic: `${topic}-dlq`, messages: [payload] });
      logger?.info?.(`Sent to DLQ ${topic}-dlq`);
    } catch (dlqErr) {
      logger?.error?.('publishEvent DLQ failed', dlqErr);
      throw dlqErr;
    }
  }
}

export async function getConsumer(groupId: string): Promise<Consumer> {
  const kafka = new Kafka(KAFKA_CONFIG);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  logger?.info?.(`Kafka consumer connected (group=${groupId})`);
  return consumer;
}

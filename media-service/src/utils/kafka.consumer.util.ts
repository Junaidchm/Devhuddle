import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";

type MessageHandler = (payload: any) => Promise<void>;

export class KafkaConsumer {
  private consumer: Consumer;
  private kafka: Kafka;
  private handlers: Map<string, MessageHandler> = new Map();

  constructor() {
    this.kafka = new Kafka(KAFKA_CONFIG);
    this.consumer = this.kafka.consumer({
        groupId: "media-service-group",
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
     });
  }

  public async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info("Kafka Consumer connected");
    } catch (error) {
      logger.error("Error connecting to Kafka", { error });
      throw error;
    }
  }

  public async subscribe(topics: string[]): Promise<void> {
    try {
      await this.consumer.subscribe({ topics, fromBeginning: false });
      logger.info(`Subscribed to topics: ${topics.join(", ")}`);
    } catch (error) {
      logger.error("Error subscribing to topics", { error });
      throw error;
    }
  }

  public registerHandler(topic: string, handler: MessageHandler): void {
    this.handlers.set(topic, handler);
  }

  public async run(): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        const prefix = `${topic}[${partition}|${message.offset}] / ${message.timestamp}`;
        logger.debug(`- ${prefix} ${message.key}#${message.value}`);

        const handler = this.handlers.get(topic);
        if (handler) {
          try {
            const payload = JSON.parse(message.value?.toString() || "{}");
            await handler(payload);
          } catch (error) {
            logger.error(`Error processing message from topic ${topic}`, {
              error: (error as Error).message,
              offset: message.offset,
            });
            // TODO: Send to DLQ
          }
        } else {
            logger.warn(`No handler for topic ${topic}`);
        }
      },
    });
  }

  public async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    logger.info("Kafka Consumer disconnected");
  }
}

export const kafkaConsumer = new KafkaConsumer();

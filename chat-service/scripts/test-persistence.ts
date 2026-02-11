import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { MessageSagaService } from "../src/services/impliments/message.service";
import { ChatRepository } from "../src/repositories/impliments/chat.repository";
import { SendMessageCommand } from "../src/dtos/chat-service.dto";
import { connectRedis } from "../src/config/redis.config";
import logger from "../src/utils/logger.util";

async function run() {
    logger.info("🚀 Starting Persistence Diagnostic...");

    await connectRedis();
    logger.info("👉 [DEBUG] DB URL:", { url: process.env.DATABASE_URL?.split('@')[1] || "UNDEFINED or LOCAL" });
    
    // Mock Redis for Saga? No, we want real integration if possible. 
    // If Redis fails, script fails, which is good diagnostic.

    const repo = new ChatRepository();
    const saga = new MessageSagaService(repo);

    // Mock Data
    const senderId = "user_1"; // Replace with a valid user ID if FK constraints exist
    const recipientIds = ["user_2"];
    const content = "Diagnostic Test Message " + new Date().toISOString();
    
    // We can try with and without conversationId to test both paths
    // Path 1: Create new conversation
    logger.info("🧪 Test 1: Sending message (New Conversation)...");
    
    // Safety Timeout
    const timeout = setTimeout(() => {
        logger.error("❌ TIMEOUT: Script hung for 10 seconds!");
        process.exit(1);
    }, 10000);

    try {
        const command1 = new SendMessageCommand(
            senderId,
            recipientIds,
            content,
            'TEXT'
        );
        
        logger.info("👉 Calling saga.sendMessage...");
        const result1 = await saga.sendMessage(command1);
        logger.info("✅ Test 1 Success:", result1);
    } catch (e) {
        logger.error("❌ Test 1 Failed:", { error: e instanceof Error ? e.message : String(e) });
    } finally {
        clearTimeout(timeout);
    }

    process.exit(0);
}

run().catch(console.error);

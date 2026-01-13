import express from "express";
import { createServer } from "http";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import { WebSocketService } from "./utils/websocket.util";
import { ChatRepository } from "./repositories/impliments/chat.repository";
import { ChatService } from "./services/impliments/chat.service";
import { ChatController } from "./controllers/impliments/chat.controller";
import { createChatRoutes } from "./routes/chat.routes";
import { connectRedis } from "./config/redis.config";
import { getProducer } from "./utils/kafka.util";
import logger from "./utils/logger.util";

const PORT = process.env.PORT || 4004;

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "chat-service",
        timestamp: new Date().toISOString()
    });
});

// Start server function
async function startServer() {
    try {
        // 1. Connect to Redis
        logger.info("Connecting to Redis...");
        await connectRedis();
        logger.info("✅ Redis connected successfully");

        // 2. Initialize Kafka producer
        logger.info("Initializing Kafka producer...");
        await getProducer();
        logger.info("✅ Kafka producer initialized");

        // 3. Initialize services
        const chatRepository = new ChatRepository();
        const chatService = new ChatService(chatRepository);
        const chatController = new ChatController(chatService);
        logger.info("✅ Chat service initialized");

        // 4. Register REST API routes
        const chatRoutes = createChatRoutes(chatController);
        app.use('/api/v1/chat', chatRoutes);
        logger.info("✅ REST API routes registered");

        // 5. Initialize WebSocket server
        logger.info("Initializing WebSocket server...");
        new WebSocketService(server, chatService);
        logger.info("✅ WebSocket server initialized");

        // 6. Start HTTP server
        server.listen(PORT, () => {
            logger.info(`🚀 Chat service running on port ${PORT}`);
            logger.info(`📡 WebSocket endpoint: ws://localhost:${PORT}/api/v1/chat`);
            logger.info(`💚 Health check: http://localhost:${PORT}/health`);
            logger.info(`🔌 REST API: http://localhost:${PORT}/api/v1/chat`);
        });

    } catch (error) {
        logger.error("❌ Failed to start server", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        process.exit(1);
    }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    logger.error("❌ Uncaught exception", { error: error.message });
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    logger.error("❌ Unhandled rejection", { reason });
    process.exit(1);
});

// Start the server
startServer();
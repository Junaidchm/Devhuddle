import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import helmet from "helmet";
import compression from "compression";
import { WebSocketService } from "./utils/websocket.util";
import { ChatRepository } from "./repositories/impliments/chat.repository";
import { ChatService } from "./services/impliments/chat.service";
import { ChatController } from "./controllers/impliments/chat.controller";
import { GroupController } from './controllers/impliments/group.controller';
import { createChatRoutes } from "./routes/chat.routes";
import { GroupService } from "./services/impliments/group.service";
import { HubJoinRequestRepository } from "./repositories/impliments/hub-request.repository";
import { HubRequestService } from "./services/impliments/hub.request.service";
import { HubRequestController } from "./controllers/impliments/hub.request.controller";
import { ReportService } from "./services/impliments/report.service";
import { ReportController } from "./controllers/impliments/report.controller";
import { AdminService } from "./services/impliments/admin.service";
import { AdminController } from "./controllers/impliments/admin.controller";
import { setupAdminRoutes } from "./routes/admin.routes";
import { connectRedis } from "./config/redis.config";
import { getProducer } from "./utils/kafka.util";
import { startAdminConsumer } from "./consumers/admin.consumer";
import { startHubActivationConsumer } from "./consumers/hub.activation.consumer";
import logger from "./utils/logger.util";
import { startGrpcServer } from "./grpc/server";
import { MessageSagaService } from "./services/impliments/message.service";
import { ChatActionService } from "./services/impliments/chat-action.service";
import { CallRepository } from "./repositories/impliments/call.repository";

const PORT = process.env.PORT || 4004;

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`>>> CHAT_BUILD_V13 <<<`);
    console.log(`CHAT_INBOUND: ${req.method} ${req.url}`);
    next();
});

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
        
        const messageSagaService = new MessageSagaService(chatRepository);
        const chatActionService = new ChatActionService(chatRepository);
        const chatService = new ChatService(messageSagaService, chatRepository, chatActionService);
        const reportService = new ReportService(chatRepository);
        const hubJoinRequestRepository = new HubJoinRequestRepository();
        const hubRequestService = new HubRequestService(hubJoinRequestRepository, chatRepository, messageSagaService);

        const chatController = new ChatController(chatService);
        const groupService = new GroupService(chatRepository, messageSagaService, hubJoinRequestRepository);
        const groupController = new GroupController(groupService);
        const reportController = new ReportController(reportService);
        const hubRequestController = new HubRequestController(hubRequestService);
        const adminService = new AdminService(chatRepository);
        const adminController = new AdminController(adminService);

        logger.info("✅ Chat service initialized");

        // 3b. Start domain specific consumers
        await startHubActivationConsumer(chatRepository, messageSagaService);
        logger.info("✅ Hub activation consumer started");

        // 4. Register REST API routes
        const chatRoutes = createChatRoutes(chatController, groupController, reportController, hubRequestController);
        // Gateway forwards /api/v1/chat, while local/internal might use /chat
        app.use(['/api/v1/chat', '/chat'], chatRoutes);

        const adminRoutes = setupAdminRoutes(adminController);
        app.use(['/api/v1/admin', '/admin'], adminRoutes);
        
        logger.info("✅ REST API routes registered");

        // 4. Initialize WebSocket server (earlier so consumers can use it)
        const callRepository = new CallRepository();
        logger.info("Initializing WebSocket server...");
        const wsService = new WebSocketService(server, chatService, callRepository);
        logger.info("✅ WebSocket server initialized");

        // 5. Start consumers
        await startAdminConsumer();
        logger.info("✅ Admin enforcement consumer started");

        // 7. Start HTTP server
        server.listen(Number(PORT), "0.0.0.0", () => {
            logger.info(`✅ Chat service HTTP running on 0.0.0.0:${PORT}`);
            
            // 8. Start gRPC server
            const GRPC_PORT = parseInt(process.env.GRPC_PORT || '50051');
            logger.info(`Starting gRPC server on port ${GRPC_PORT}...`);
            startGrpcServer(GRPC_PORT);

            logger.info(`📡 WebSocket endpoint: ws://localhost:${PORT}/chat`);
            logger.info(`💚 Health check: http://localhost:${PORT}/health`);
            logger.info(`🔌 REST API: http://localhost:${PORT}/chat`);
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

process.on("unhandledRejection", (reason: any) => {
    const errorDetails = reason instanceof Error ? reason.stack || reason.message : reason;
    logger.error("❌ Unhandled rejection", { reason: errorDetails });
    process.exit(1);
});

// Start the server
startServer();
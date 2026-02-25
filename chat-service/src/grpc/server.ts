import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { ChatStatsController } from '../controllers/impliments/chat.stats.controller';
import { ChatStatsService } from '../services/impliments/chat.stats.service';
import { ChatInteractionRepository } from '../repositories/impliments/chat-interaction.repository';
import { ChatRepository } from '../repositories/impliments/chat.repository';
import { AdminService } from '../services/impliments/admin.service';
import { AdminController } from '../controllers/impliments/admin.controller';
import logger from '../utils/logger.util';

const PROTO_PATH = path.join(__dirname, '../../protos/chat-stats.proto');

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const chatStatsService = protoDescriptor.chatstats.ChatStatsService;

const ADMIN_PROTO_PATH = path.join(__dirname, '../../protos/admin.proto');
const adminPackageDefinition = protoLoader.loadSync(ADMIN_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const adminProtoDescriptor = grpc.loadPackageDefinition(adminPackageDefinition) as any;
const adminService = adminProtoDescriptor.admin.AdminService;

export function startGrpcServer(port: number = 50051): void {
  const server = new grpc.Server();

  const chatInteractionRepository = new ChatInteractionRepository();
  const chatStatsServiceLayer = new ChatStatsService(chatInteractionRepository);
  const chatStatsController = new ChatStatsController(chatStatsServiceLayer);

  logger.info('✅ gRPC layers initialized (Repository → Service → Controller)');
  
  const serviceDef = chatStatsService.service;
  const keys = Object.keys(serviceDef);
  logger.info(`🔍 Service Keys: ${JSON.stringify(keys)}`);
  keys.forEach(key => {
    logger.info(`🔍 Method ${key} path: ${serviceDef[key].path}`);
  });

  // Register chat stats service
  server.addService(chatStatsService.service, {
    GetChatStats: chatStatsController.getChatStats.bind(chatStatsController),
    getChatStats: chatStatsController.getChatStats.bind(chatStatsController),
    GetRecentChatPartners: chatStatsController.getRecentChatPartners.bind(chatStatsController),
    getRecentChatPartners: chatStatsController.getRecentChatPartners.bind(chatStatsController),
  });

  // Register admin service
  const chatRepository = new ChatRepository();
  const adminServiceLayer = new AdminService(chatRepository);
  const adminController = new AdminController(adminServiceLayer);

  server.addService(adminService.service, {
    SubmitReport: () => { /* Placeholder or implement if needed */ },
    GetUserStatus: () => { /* Placeholder or implement if needed */ },
    GetHubStats: adminController.getHubStats.bind(adminController),
    getHubStats: adminController.getHubStats.bind(adminController),
  });

  // Start server
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, boundPort) => {
      if (error) {
        logger.error('❌ gRPC server failed to start', { error: error.message });
        return;
      }
      logger.info(`✅ gRPC ChatStatsService running on port ${boundPort}`);
      server.start();
    }
  );
}

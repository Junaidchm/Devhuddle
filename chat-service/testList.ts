import { ChatController } from './src/controllers/impliments/chat.controller';
import { ChatService } from './src/services/impliments/chat.service';
import { ChatRepository } from './src/repositories/impliments/chat.repository';

async function main() {
    const chatRepo = new ChatRepository();
    // Assuming authServiceClient and redis are up, but we'll just mock or bypass if needed
    // Let's directly call chatRepo.getUserConversationsWithMetadata since the service just wraps it with gRPC
    const convs = await chatRepo.getUserConversationsWithMetadata('80922465-c281-4331-b931-7932da62c316', 50, 0);
    console.log("Returned conv count:", convs.length);
    console.log(JSON.stringify(convs.map(c => ({
        id: c.id, 
        lastMessage: c.lastMessage?.id || null, 
        lastMessageAt: c.lastMessageAt
    })), null, 2));
}

main().catch(console.error);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ChatService } from '../chat/chat.service';

async function testConversationCleanup() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const chatService = app.get(ChatService);
  
  console.log('Testing conversation cleanup...');
  
  const result = await chatService.cleanupEmptyConversations();
  
  console.log('Cleanup result:', result);
  
  await app.close();
}

testConversationCleanup().catch(console.error);
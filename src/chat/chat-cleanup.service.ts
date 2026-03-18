import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';

@Injectable()
export class ChatCleanupService {
  constructor(private chatService: ChatService) {}

  // Run cleanup every 2 minutes
  @Cron('0 */2 * * * *')
  async handleEmptyConversationCleanup() {
    console.log('Starting scheduled cleanup of empty conversations...');
    await this.chatService.cleanupEmptyConversations();
  }
}
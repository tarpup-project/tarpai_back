import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIChatService } from './ai-chat.service';
import { ReminderService } from './reminder.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiChatService: AIChatService,
    private readonly reminderService: ReminderService,
  ) {}

  @Post('chat')
  async sendMessage(@Req() req, @Body() body: { message: string }) {
    const userId = req.user.id;
    return this.aiChatService.sendMessage(userId, body.message);
  }

  @Get('history')
  async getHistory(@Req() req) {
    const userId = req.user.id;
    const messages = await this.aiChatService.getConversationHistory(userId);
    return { messages };
  }

  @Delete('conversation')
  async clearConversation(@Req() req) {
    const userId = req.user.id;
    await this.aiChatService.clearConversation(userId);
    return { message: 'Conversation cleared successfully' };
  }

  @Get('reminders')
  async getReminders(@Req() req) {
    const userId = req.user.id;
    const reminders = await this.reminderService.getUserReminders(userId);
    return { reminders };
  }

  @Delete('reminders/:id')
  async deleteReminder(@Req() req, @Param('id') reminderId: string) {
    const userId = req.user.id;
    await this.reminderService.deleteReminder(reminderId, userId);
    return { message: 'Reminder deleted successfully' };
  }
}

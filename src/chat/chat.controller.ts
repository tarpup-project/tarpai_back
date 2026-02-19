import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Get all conversations for user
  @Get('conversations')
  getUserConversations(@Req() req) {
    return this.chatService.getUserConversations(req.user.id);
  }

  // Create or get conversation with another user
  @Post('conversations')
  createConversation(
    @Body() body: { participantId: string },
    @Req() req,
  ) {
    return this.chatService.createConversation(req.user.id, body.participantId);
  }

  // Get single conversation
  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @Req() req) {
    return this.chatService.getConversation(id, req.user.id);
  }

  // Get messages in a conversation
  @Get('conversations/:id/messages')
  getConversationMessages(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Req() req,
  ) {
    return this.chatService.getConversationMessages(
      id,
      req.user.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  // Send message (for REST API, WebSocket is preferred)
  @Post('conversations/:id/messages')
  @UseInterceptors(FileInterceptor('file'))
  sendMessage(
    @Param('id') conversationId: string,
    @Body() body: { content: string; type?: string; replyTo?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.chatService.sendMessage(
      conversationId,
      req.user.id,
      body.content,
      body.type || 'text',
      file,
      body.replyTo,
    );
  }

  // Mark messages as read
  @Put('conversations/:id/read')
  markMessagesAsRead(@Param('id') conversationId: string, @Req() req) {
    return this.chatService.markMessagesAsRead(conversationId, req.user.id);
  }

  // Edit message
  @Put('messages/:id')
  editMessage(
    @Param('id') messageId: string,
    @Body() body: { content: string },
    @Req() req,
  ) {
    return this.chatService.editMessage(messageId, req.user.id, body.content);
  }

  // Delete message
  @Delete('messages/:id')
  deleteMessage(@Param('id') messageId: string, @Req() req) {
    return this.chatService.deleteMessage(messageId, req.user.id);
  }

  // Search users for new conversation
  @Get('users/search')
  searchUsers(@Query('q') query: string, @Req() req) {
    return this.chatService.searchUsers(query, req.user.id);
  }

  // Get total unread count
  @Get('unread-count')
  getTotalUnreadCount(@Req() req) {
    return this.chatService.getTotalUnreadCount(req.user.id);
  }
}
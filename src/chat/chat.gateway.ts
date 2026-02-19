import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      client.userId = decoded.id;
      
      // Store user connection
      this.connectedUsers.set(decoded.id, client.id);
      
      // Join user to their personal room
      client.join(`user_${decoded.id}`);
      
      // Join user to all their conversation rooms
      const conversations = await this.chatService.getUserConversations(decoded.id);
      conversations.forEach(conv => {
        client.join(`conversation_${conv.id}`);
      });

      console.log(`User ${decoded.id} connected with socket ${client.id}`);
      
      // Notify user is online
      client.broadcast.emit('user_online', { userId: decoded.id });
      
    } catch (error) {
      console.log('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      console.log(`User ${client.userId} disconnected`);
      
      // Notify user is offline
      client.broadcast.emit('user_offline', { userId: client.userId });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string; type?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        client.userId,
        data.content,
        data.type || 'text',
      );

      // Emit to all participants in the conversation
      this.server.to(`conversation_${data.conversationId}`).emit('new_message', message);
      
      // Update conversation for all participants
      const conversation = await this.chatService.getConversation(data.conversationId, client.userId);
      this.server.to(`conversation_${data.conversationId}`).emit('conversation_updated', conversation);

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await this.chatService.markMessagesAsRead(data.conversationId, client.userId);
      
      // Notify other participants that messages were read
      client.to(`conversation_${data.conversationId}`).emit('messages_read', {
        conversationId: data.conversationId,
        userId: client.userId,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.to(`conversation_${data.conversationId}`).emit('user_typing', {
      userId: client.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.to(`conversation_${data.conversationId}`).emit('user_stopped_typing', {
      userId: client.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.join(`conversation_${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.leave(`conversation_${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('check_user_status')
  async handleCheckUserStatus(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isOnline = this.isUserOnline(data.userId);
    client.emit('user_status', { userId: data.userId, isOnline });
    return { success: true, isOnline };
  }

  // Method to send notification to specific user
  async sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification', notification);
    }
  }

  // Method to check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
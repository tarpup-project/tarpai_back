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
import { Inject, forwardRef } from '@nestjs/common';
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
  private activeConversations = new Map<string, Set<string>>(); // conversationId -> Set of userIds viewing it
  private usersOnChatsPage = new Map<string, number>(); // userId -> timestamp when they registered on chats page
  private conversationLeftTimestamps = new Map<string, number>(); // `${userId}_${conversationId}` -> timestamp when user left

  constructor(
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {
    // Clean up stale chats page entries every 60 seconds
    setInterval(() => {
      this.cleanupStaleChatsPageEntries();
    }, 60000);
  }

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
      
      // Don't automatically join conversation rooms - let them join explicitly when viewing conversations

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
      
      // Remove user from chats page tracking
      this.usersOnChatsPage.delete(client.userId);
      
      // Remove user from all active conversations
      this.activeConversations.forEach((viewers, conversationId) => {
        viewers.delete(client.userId!);
        if (viewers.size === 0) {
          this.activeConversations.delete(conversationId);
        }
      });
      
      // Notify user is offline
      client.broadcast.emit('user_offline', { userId: client.userId });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string; type?: string; replyTo?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        client.userId,
        data.content,
        data.type || 'text',
        undefined,
        data.replyTo,
      );

      // Emit to all participants in the conversation
      this.server.to(`conversation_${data.conversationId}`).emit('new_message', message);
      
      // Get conversation document to find all participants
      const conversationDoc = await this.chatService.getConversationDocument(data.conversationId);
      if (conversationDoc) {
        // Emit to each participant individually with their specific unread count
        conversationDoc.participants.forEach(async (participantId: any) => {
          const socketId = this.connectedUsers.get(participantId.toString());
          if (socketId) {
            // Get conversation with this participant's unread count
            const participantConversation = await this.chatService.getConversation(
              data.conversationId,
              participantId.toString(),
            );
            this.server.to(socketId).emit('conversation_updated', participantConversation);
          }
        });
      }

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
    
    // Clear the left timestamp when user rejoins
    const key = `${client.userId}_${data.conversationId}`;
    this.conversationLeftTimestamps.delete(key);
    
    // Track that this user is viewing this conversation
    if (!this.activeConversations.has(data.conversationId)) {
      this.activeConversations.set(data.conversationId, new Set());
    }
    
    const viewers = this.activeConversations.get(data.conversationId)!;
    
    // Check if there are already viewers in this conversation
    const existingViewers = Array.from(viewers);
    
    // Add this user to viewers
    viewers.add(client.userId!);
    
    // Notify this user about existing viewers immediately
    existingViewers.forEach(viewerId => {
      if (viewerId !== client.userId) {
        // Send immediately to the joining user
        client.emit('user_joined_conversation', {
          conversationId: data.conversationId,
          userId: viewerId,
        });
      }
    });
    
    // Notify other participants in this conversation that this user joined
    client.to(`conversation_${data.conversationId}`).emit('user_joined_conversation', {
      conversationId: data.conversationId,
      userId: client.userId,
    });
    
    return { 
      success: true,
      existingViewers: existingViewers.filter(id => id !== client.userId),
    };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.leave(`conversation_${data.conversationId}`);
    
    // Track when user left this conversation
    const key = `${client.userId}_${data.conversationId}`;
    this.conversationLeftTimestamps.set(key, Date.now());
    
    // Remove user from active viewers
    const viewers = this.activeConversations.get(data.conversationId);
    if (viewers) {
      viewers.delete(client.userId!);
      if (viewers.size === 0) {
        this.activeConversations.delete(data.conversationId);
      }
    }
    
    // Notify other participants in this conversation that this user left
    client.to(`conversation_${data.conversationId}`).emit('user_left_conversation', {
      conversationId: data.conversationId,
      userId: client.userId,
    });
    
    return { success: true };
  }

  @SubscribeMessage('check_conversation_viewer')
  async handleCheckConversationViewer(
    @MessageBody() data: { conversationId: string; userId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isActive = this.isUserActiveInChat(data.userId, data.conversationId);
    
    client.emit('conversation_viewer_status', {
      conversationId: data.conversationId,
      userId: data.userId,
      isViewing: isActive, // Show active if viewing conversation OR on chats page
    });
    return { success: true, isViewing: isActive };
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

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string; conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await this.chatService.deleteMessage(data.messageId, client.userId);
      
      // Notify all participants in the conversation
      this.server.to(`conversation_${data.conversationId}`).emit('message_deleted', {
        messageId: data.messageId,
        conversationId: data.conversationId,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
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

  // Method to check if user is viewing a specific conversation (for unread count logic)
  isUserViewingConversation(userId: string, conversationId: string): boolean {
    const viewers = this.activeConversations.get(conversationId);
    return viewers ? viewers.has(userId) : false;
  }

  // Method to check if user has been inactive for more than an hour
  hasUserBeenInactiveForAnHour(userId: string, conversationId: string): boolean {
    const key = `${userId}_${conversationId}`;
    const leftTimestamp = this.conversationLeftTimestamps.get(key);
    
    if (!leftTimestamp) {
      // No record of leaving, assume they haven't been inactive
      return false;
    }
    
    const now = Date.now();
    const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
    const timeSinceLeft = now - leftTimestamp;
    
    return timeSinceLeft >= oneHourInMs;
  }

  // Method to check if user is active (for "Active now" display - includes chats page)
  isUserActiveInChat(userId: string, conversationId: string): boolean {
    const isViewingConversation = this.isUserViewingConversation(userId, conversationId);
    const isOnChatsPage = this.isUserOnChatsPage(userId);
    return isViewingConversation || isOnChatsPage;
  }

  // Method to check if user is on chats page (with 30 second timeout)
  private isUserOnChatsPage(userId: string): boolean {
    const timestamp = this.usersOnChatsPage.get(userId);
    if (!timestamp) return false;
    
    const now = Date.now();
    const thirtySecondsAgo = now - 30000; // 30 seconds
    
    if (timestamp < thirtySecondsAgo) {
      // Remove stale entry
      this.usersOnChatsPage.delete(userId);
      return false;
    }
    
    return true;
  }

  // Method to register user as being on chats page
  setUserOnChatsPage(userId: string, isOnChatsPage: boolean) {
    if (isOnChatsPage) {
      this.usersOnChatsPage.set(userId, Date.now());
    } else {
      this.usersOnChatsPage.delete(userId);
    }
  }

  // Cleanup stale chats page entries
  private cleanupStaleChatsPageEntries() {
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    
    for (const [userId, timestamp] of this.usersOnChatsPage.entries()) {
      if (timestamp < thirtySecondsAgo) {
        this.usersOnChatsPage.delete(userId);
      }
    }
  }
}
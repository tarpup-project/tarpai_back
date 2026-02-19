import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './conversation.schema';
import { Message } from './message.schema';
import { User } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async createConversation(userId: string, participantId: string) {
    // Check if conversation already exists
    const existingConversation = await this.conversationModel.findOne({
      participants: {
        $all: [new Types.ObjectId(userId), new Types.ObjectId(participantId)],
        $size: 2,
      },
    });

    if (existingConversation) {
      return this.getConversation(existingConversation._id.toString(), userId);
    }

    // Check if users follow each other or if one follows the other
    const user = await this.userModel.findById(userId);
    const participant = await this.userModel.findById(participantId);

    if (!user || !participant) {
      throw new NotFoundException('User not found');
    }

    const userFollowsParticipant = user.following.some(id => id.toString() === participantId);
    const participantFollowsUser = participant.following.some(id => id.toString() === userId);

    if (!userFollowsParticipant && !participantFollowsUser) {
      throw new ForbiddenException('You can only chat with people you follow or who follow you');
    }

    const conversation = new this.conversationModel({
      participants: [new Types.ObjectId(userId), new Types.ObjectId(participantId)],
      lastActivity: new Date(),
      unreadCount: new Map(),
      isActive: true,
    });

    await conversation.save();

    return this.getConversation(conversation._id.toString(), userId);
  }

  async getUserConversations(userId: string) {
    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        isActive: true,
      })
      .populate('participants', 'name username avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name username avatar',
        },
      })
      .sort({ lastActivity: -1 })
      .exec();

    return conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
      const unreadCount = conv.unreadCount.get(userId) || 0;

      return {
        id: conv._id,
        participant: otherParticipant,
        lastMessage: conv.lastMessage,
        unreadCount,
        lastActivity: conv.lastActivity,
      };
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'name username avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name username avatar',
        },
      })
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.some(p => p._id.toString() === userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const otherParticipant = conversation.participants.find(p => p._id.toString() !== userId);
    const unreadCount = conversation.unreadCount.get(userId) || 0;

    return {
      id: conversation._id,
      participant: otherParticipant,
      lastMessage: conversation.lastMessage,
      unreadCount,
      lastActivity: conversation.lastActivity,
    };
  }

  async getConversationMessages(conversationId: string, userId: string, page: number = 1, limit: number = 50) {
    const conversation = await this.conversationModel.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.some(p => p.toString() === userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({
        conversation: new Types.ObjectId(conversationId),
        isDeleted: false,
      })
      .populate('sender', 'name username avatar')
      .populate({
        path: 'replyTo',
        select: 'content sender',
        populate: {
          path: 'sender',
          select: 'name username avatar',
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return {
      messages: messages.reverse().map(msg => ({
        id: msg._id,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        sender: msg.sender,
        replyTo: msg.replyTo ? {
          id: (msg.replyTo as any)._id,
          content: (msg.replyTo as any).content,
          sender: (msg.replyTo as any).sender._id,
        } : undefined,
        isRead: msg.readBy.some(id => id.toString() === userId),
        isEdited: msg.isEdited,
        createdAt: msg.createdAt,
      })),
      hasMore: messages.length === limit,
      page,
    };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: string = 'text',
    file?: Express.Multer.File,
    replyToId?: string,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.some(p => p.toString() === senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    let fileUrl: string | undefined;
    let fileName: string | undefined;

    if (file) {
      fileUrl = await this.cloudinaryService.uploadImage(file);
      fileName = file.originalname;
    }

    const messageData: any = {
      conversation: new Types.ObjectId(conversationId),
      sender: new Types.ObjectId(senderId),
      content,
      type,
      fileUrl,
      fileName,
      readBy: [new Types.ObjectId(senderId)], // Sender has read their own message
    };

    // Add reply reference if provided
    if (replyToId) {
      messageData.replyTo = new Types.ObjectId(replyToId);
    }

    const message = new this.messageModel(messageData);

    await message.save();

    // Update conversation
    conversation.lastMessage = message._id as any;
    conversation.lastActivity = new Date();

    // Get sender info for notification
    const sender = await this.userModel.findById(senderId);
    const senderName = sender?.displayName || sender?.name || 'Someone';

    // Update unread count and create notification for other participants
    const notificationPromises: Promise<void>[] = [];
    
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== senderId) {
        // Check if the recipient is currently viewing this conversation
        const isViewingConversation = this.chatGateway.isUserViewingConversation(
          participantId.toString(),
          conversationId,
        );
        
        // Only increment unread count if NOT viewing the conversation
        if (!isViewingConversation) {
          const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
          conversation.unreadCount.set(participantId.toString(), currentCount + 1);
          
          // Create notification for recipient (async)
          const notificationPromise = this.notificationsService.createChatNotification(
            senderId,
            participantId.toString(),
            `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`,
          ).then(() => {
            // Send real-time notification via socket with complete data
            this.chatGateway.sendNotificationToUser(participantId.toString(), {
              _id: new Date().getTime().toString(), // Temporary ID
              type: 'chat_message',
              title: 'New Message',
              message: `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`,
              isRead: false,
              createdAt: new Date().toISOString(),
              sender: {
                _id: senderId,
                name: senderName,
                username: sender?.username || '',
                avatar: sender?.avatar || '',
              },
            });
          });
          
          notificationPromises.push(notificationPromise);
        }
      }
    });

    // Wait for all notifications to be created
    await Promise.all(notificationPromises);

    await conversation.save();

    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name username avatar')
      .populate({
        path: 'replyTo',
        select: 'content sender',
        populate: {
          path: 'sender',
          select: 'name username avatar',
        },
      })
      .exec();

    const messageResponse = {
      id: populatedMessage._id,
      content: populatedMessage.content,
      type: populatedMessage.type,
      fileUrl: populatedMessage.fileUrl,
      fileName: populatedMessage.fileName,
      sender: populatedMessage.sender,
      replyTo: populatedMessage.replyTo ? {
        id: (populatedMessage.replyTo as any)._id,
        content: (populatedMessage.replyTo as any).content,
        sender: (populatedMessage.replyTo as any).sender._id,
      } : undefined,
      isRead: false,
      isEdited: populatedMessage.isEdited,
      createdAt: populatedMessage.createdAt,
    };

    // Emit the message via socket to all participants
    this.chatGateway.server.to(`conversation_${conversationId}`).emit('new_message', messageResponse);
    
    // Emit conversation updates to each participant
    const conversationDoc = await this.conversationModel.findById(conversationId);
    if (conversationDoc) {
      conversationDoc.participants.forEach(async (participantId: any) => {
        const socketId = this.chatGateway['connectedUsers'].get(participantId.toString());
        if (socketId) {
          const participantConversation = await this.getConversation(
            conversationId,
            participantId.toString(),
          );
          this.chatGateway.server.to(socketId).emit('conversation_updated', participantConversation);
        }
      });
    }

    return messageResponse;
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.some(p => p.toString() === userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Mark all unread messages as read
    await this.messageModel.updateMany(
      {
        conversation: new Types.ObjectId(conversationId),
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
    );

    // Reset unread count
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    return { success: true };
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    await message.save();

    return { success: true };
  }

  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await this.messageModel.findById(messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    message.content = newContent;
    message.isEdited = true;
    await message.save();

    const populatedMessage = await this.messageModel
      .findById(messageId)
      .populate('sender', 'name username avatar')
      .exec();

    return {
      id: populatedMessage._id,
      content: populatedMessage.content,
      type: populatedMessage.type,
      sender: populatedMessage.sender,
      isEdited: populatedMessage.isEdited,
      createdAt: populatedMessage.createdAt,
    };
  }

  async searchUsers(query: string, userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get users that follow the current user or that the current user follows
    const followingIds = user.following.map(id => id.toString());
    const followerIds = user.followers.map(id => id.toString());
    const allowedUserIds = [...new Set([...followingIds, ...followerIds])];

    const users = await this.userModel
      .find({
        _id: { $in: allowedUserIds.map(id => new Types.ObjectId(id)) },
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { username: { $regex: query, $options: 'i' } },
        ],
      })
      .select('name username avatar')
      .limit(20)
      .exec();

    return users.map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    }));
  }

  async getTotalUnreadCount(userId: string) {
    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        isActive: true,
      })
      .exec();

    let totalUnread = 0;
    conversations.forEach(conv => {
      totalUnread += conv.unreadCount.get(userId) || 0;
    });

    return { totalUnreadCount: totalUnread };
  }

  async getConversationDocument(conversationId: string) {
    return this.conversationModel.findById(conversationId).exec();
  }
}
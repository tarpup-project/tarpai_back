import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './conversation.schema';
import { Message } from './message.schema';
import { User } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
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

    const message = new this.messageModel({
      conversation: new Types.ObjectId(conversationId),
      sender: new Types.ObjectId(senderId),
      content,
      type,
      fileUrl,
      fileName,
      readBy: [new Types.ObjectId(senderId)], // Sender has read their own message
    });

    await message.save();

    // Update conversation
    conversation.lastMessage = message._id as any;
    conversation.lastActivity = new Date();

    // Update unread count for other participants
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== senderId) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save();

    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name username avatar')
      .exec();

    return {
      id: populatedMessage._id,
      content: populatedMessage.content,
      type: populatedMessage.type,
      fileUrl: populatedMessage.fileUrl,
      fileName: populatedMessage.fileName,
      sender: populatedMessage.sender,
      isRead: false,
      isEdited: populatedMessage.isEdited,
      createdAt: populatedMessage.createdAt,
    };
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
}
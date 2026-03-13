import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './conversation.schema';
import { Message } from './message.schema';
import { User } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from './chat.gateway';
import { EmailService } from '../auth/email.service';
import { AiService } from './ai.service';
import { LinkPreviewService } from './link-preview.service';

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
    private emailService: EmailService,
    private aiService: AiService,
    private linkPreviewService: LinkPreviewService,
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
    // Add a small retry mechanism to handle race conditions
    let user, participant;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      user = await this.userModel.findById(userId);
      participant = await this.userModel.findById(participantId);

      if (!user || !participant) {
        throw new NotFoundException('User not found');
      }

      const userFollowsParticipant = user.following.some(id => id.toString() === participantId);
      const participantFollowsUser = participant.following.some(id => id.toString() === userId);

      if (userFollowsParticipant || participantFollowsUser) {
        // Follow relationship found, proceed with conversation creation
        break;
      }

      // If no follow relationship found and this is not the last retry, wait and try again
      if (retryCount < maxRetries - 1) {
        console.log(`Follow relationship not found, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms before retry
        retryCount++;
      } else {
        throw new ForbiddenException('You can only chat with people you follow or who follow you');
      }
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

  async createGroupConversation(userId: string, participantIds: string[], groupName?: string) {
    // Validate that we have at least 2 participants (excluding creator)
    if (!participantIds || participantIds.length < 1) {
      throw new ForbiddenException('Group must have at least 2 members');
    }

    // Remove duplicates and ensure creator is not in the list
    const uniqueParticipantIds = [...new Set(participantIds)].filter(id => id !== userId);

    if (uniqueParticipantIds.length < 1) {
      throw new ForbiddenException('Group must have at least 2 members');
    }

    // Verify all participants exist
    const participants = await this.userModel.find({
      _id: { $in: uniqueParticipantIds.map(id => new Types.ObjectId(id)) },
    });

    if (participants.length !== uniqueParticipantIds.length) {
      throw new NotFoundException('One or more participants not found');
    }

    // Create all participant IDs including creator
    const allParticipantIds = [userId, ...uniqueParticipantIds];

    // Generate group name if not provided
    let finalGroupName = groupName;
    if (!finalGroupName) {
      // Get names of all participants
      const allUsers = await this.userModel.find({
        _id: { $in: allParticipantIds.map(id => new Types.ObjectId(id)) },
      });
      
      const names = allUsers.map(u => u.displayName || u.name).slice(0, 3);
      finalGroupName = names.join(', ');
      if (allUsers.length > 3) {
        finalGroupName += ` +${allUsers.length - 3}`;
      }
    }

    const conversation = new this.conversationModel({
      participants: allParticipantIds.map(id => new Types.ObjectId(id)),
      lastActivity: new Date(),
      unreadCount: new Map(),
      isActive: true,
      isGroup: true,
      groupName: finalGroupName,
    });

    await conversation.save();

    // Return populated conversation
    const populatedConversation = await this.conversationModel
      .findById(conversation._id)
      .populate('participants', 'name displayName username avatar')
      .exec();

    return {
      id: populatedConversation._id,
      isGroup: true,
      groupName: populatedConversation.groupName,
      participants: populatedConversation.participants,
      lastMessage: null,
      unreadCount: 0,
      lastActivity: populatedConversation.lastActivity,
    };
  }

  async getUserConversations(userId: string) {
    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        isActive: true,
      })
      .populate('participants', 'name displayName username avatar')
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
      const unreadCount = conv.unreadCount.get(userId) || 0;

      if (conv.isGroup) {
        // Group conversation
        return {
          id: conv._id,
          isGroup: true,
          groupName: conv.groupName,
          participants: conv.participants,
          lastMessage: conv.lastMessage,
          unreadCount,
          lastActivity: conv.lastActivity,
          hasUrgentMessage: conv.hasUrgentMessage && conv.urgentMessageSender?.toString() !== userId,
        };
      } else {
        // Direct message
        const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
        return {
          id: conv._id,
          isGroup: false,
          participant: otherParticipant,
          lastMessage: conv.lastMessage,
          unreadCount,
          lastActivity: conv.lastActivity,
          hasUrgentMessage: conv.hasUrgentMessage && conv.urgentMessageSender?.toString() !== userId,
        };
      }
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'name displayName username avatar')
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

    const unreadCount = conversation.unreadCount.get(userId) || 0;

    if (conversation.isGroup) {
      // Group conversation
      return {
        id: conversation._id,
        isGroup: true,
        groupName: conversation.groupName,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        unreadCount,
        lastActivity: conversation.lastActivity,
      };
    } else {
      // Direct message
      const otherParticipant = conversation.participants.find(p => p._id.toString() !== userId);
      return {
        id: conversation._id,
        isGroup: false,
        participant: otherParticipant,
        lastMessage: conversation.lastMessage,
        unreadCount,
        lastActivity: conversation.lastActivity,
      };
    }
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
        linkPreview: msg.linkPreview,
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
    isUrgent: boolean = false,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.some(p => p.toString() === senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Check if sender is a silent signup user and count their messages
    const sender = await this.userModel.findById(senderId);
    if (sender && sender.isSilentSignup) {
      // Count how many messages this user has sent in this conversation
      const messageCount = await this.messageModel.countDocuments({
        conversation: new Types.ObjectId(conversationId),
        sender: new Types.ObjectId(senderId),
        isDeleted: false,
      });

      // If they've already sent 1 message (this will be their 2nd), upgrade them to normal user
      if (messageCount >= 1) {
        console.log(`Silent signup user ${senderId} has sent ${messageCount + 1} messages, upgrading to normal user`);
        sender.isSilentSignup = false;
        await sender.save();
      }
    }

    let fileUrl: string | undefined;
    let fileName: string | undefined;

    if (file) {
      fileUrl = await this.cloudinaryService.uploadImage(file);
      fileName = file.originalname;
    }

    // Extract and fetch link preview if message contains a URL
    let linkPreview: any = null;
    if (type === 'text' && content) {
      const url = this.linkPreviewService.extractUrlFromMessage(content);
      if (url) {
        linkPreview = await this.linkPreviewService.fetchLinkPreview(url);
      }
    }

    // Check if message is urgent using AI (only for text messages)
    let aiDetectedUrgent = false;
    if (type === 'text' && content && content.trim().length > 0) {
      aiDetectedUrgent = await this.aiService.isMessageUrgent(content);
      console.log('Message urgency check:', aiDetectedUrgent ? 'URGENT' : 'NORMAL');
    }

    const messageData: any = {
      conversation: new Types.ObjectId(conversationId),
      sender: new Types.ObjectId(senderId),
      content,
      type,
      fileUrl,
      fileName,
      readBy: [new Types.ObjectId(senderId)], // Sender has read their own message
      isUrgent: isUrgent || aiDetectedUrgent, // Combine user-marked and AI-detected urgency
    };

    // Add link preview if available
    if (linkPreview) {
      messageData.linkPreview = linkPreview;
    }

    // Add reply reference if provided
    if (replyToId) {
      messageData.replyTo = new Types.ObjectId(replyToId);
    }

    const message = new this.messageModel(messageData);

    await message.save();

    // Check if this is the first message in the conversation for first message notifications
    const messageCount = await this.messageModel.countDocuments({
      conversation: new Types.ObjectId(conversationId),
      isDeleted: false,
    });

    const isFirstMessage = messageCount === 1; // This is the first message if count is 1 (just saved)
    console.log('Message count in conversation:', messageCount, 'Is first message:', isFirstMessage);

    // Update conversation
    conversation.lastMessage = message._id as any;
    conversation.lastActivity = new Date();
    
    // Set hasUrgentMessage flag if this message is urgent (either user-marked or AI-detected)
    if (isUrgent || aiDetectedUrgent) {
      conversation.hasUrgentMessage = true;
      conversation.urgentMessageSender = new Types.ObjectId(senderId);
    }

    // Get sender info for notification
    const senderName = sender?.displayName || sender?.name || 'Someone';

    // Update unread count and create notification for other participants
    const notificationPromises: Promise<void>[] = [];
    
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== senderId) {
        console.log('=== Processing participant for notification ===');
        console.log('Participant ID:', participantId.toString());
        console.log('Sender ID:', senderId);
        
        // Check if the recipient is currently viewing this conversation
        const isViewingConversation = this.chatGateway.isUserViewingConversation(
          participantId.toString(),
          conversationId,
        );
        
        console.log('Is viewing conversation:', isViewingConversation);
        
        // Only increment unread count if NOT viewing the conversation
        if (!isViewingConversation) {
          const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
          conversation.unreadCount.set(participantId.toString(), currentCount + 1);
          
          console.log('Creating notification for participant:', participantId.toString());
          
          // Create notification for recipient (async)
          const notificationPromise = this.notificationsService.createChatNotification(
            senderId,
            participantId.toString(),
            `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`,
          ).then(async () => {
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
            
            console.log('Fetching recipient details for email check...');
            // Send email notification if recipient is a silent signup user
            const recipient = await this.userModel.findById(participantId);
            console.log('Recipient found:', recipient ? {
              id: recipient._id,
              name: recipient.name,
              email: recipient.email,
              isSilentSignup: recipient.isSilentSignup
            } : 'null');
            
            if (recipient) {
              // Send first message notification if this is the first message in the conversation
              if (isFirstMessage) {
                console.log('This is the first message, sending first message notification to:', recipient.email);
                try {
                  await this.emailService.sendFirstMessageNotification(
                    recipient.email,
                    recipient.displayName || recipient.name,
                    senderName,
                    content,
                    conversationId,
                  );
                  console.log('First message notification sent successfully');
                } catch (error) {
                  console.error('Failed to send first message notification:', error);
                }
              }
              // Send urgent email to ALL users if message is urgent (user-marked or AI-detected)
              else if (isUrgent || aiDetectedUrgent) {
                console.log('Message is URGENT, sending urgent email notification to:', recipient.email);
                await this.emailService.sendUrgentMessageNotification(
                  recipient.email,
                  recipient.displayName || recipient.name,
                  senderName,
                  content,
                  conversationId,
                );
                console.log('Urgent email notification sent successfully');
              } 
              // Send regular email only to silent signup users
              else if (recipient.isSilentSignup) {
                console.log('Recipient is a silent signup user, sending regular email notification...');
                await this.emailService.sendChatReplyNotification(
                  recipient.email,
                  recipient.displayName || recipient.name,
                  senderName,
                  content,
                  conversationId,
                );
                console.log('Regular email notification sent successfully');
              } else {
                console.log('Recipient is NOT a silent signup user and message is not urgent, skipping email');
              }
            } else {
              console.log('Recipient not found, skipping email');
            }
          }).catch(error => {
            console.error('Error in notification promise:', error);
          });
          
          notificationPromises.push(notificationPromise);
        } else {
          console.log('Participant is viewing conversation, skipping notification and email');
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
      linkPreview: populatedMessage.linkPreview,
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

    // Check for auto-reply after message is sent (only for text messages in direct conversations)
    if (type === 'text' && content && content.trim().length > 0 && !conversation.isGroup) {
      // Find the recipient (the other participant)
      const recipientId = conversation.participants.find(p => p.toString() !== senderId);
      if (recipientId) {
        const recipient = await this.userModel.findById(recipientId);
        if (recipient) {
          // Check if recipient is currently viewing this conversation
          const isViewingConversation = this.chatGateway.isUserViewingConversation(
            recipientId.toString(),
            conversationId,
          );
          
          console.log('Auto-reply check:', {
            recipientId: recipientId.toString(),
            isViewingConversation,
            recipientName: recipient.displayName || recipient.name
          });

          // If recipient is not viewing the conversation, check for auto-reply
          if (!isViewingConversation) {
            // Check if user has been inactive for more than 30 minutes
            const hasBeenInactiveForAnHour = await this.chatGateway.hasUserBeenInactiveForAnHour(
              recipientId.toString(),
              conversationId
            );
            
            console.log('=== AUTO-REPLY CHECK ===');
            console.log('Recipient ID:', recipientId.toString());
            console.log('Conversation ID:', conversationId);
            console.log('Is viewing conversation:', isViewingConversation);
            console.log('Has been inactive for threshold:', hasBeenInactiveForAnHour);
            console.log('Recipient name:', recipient.displayName || recipient.name);
            
            // Only send auto-reply if user is not viewing AND has been inactive for threshold time
            if (hasBeenInactiveForAnHour) {
              console.log('User has been inactive long enough, checking if message warrants auto-reply...');
              
              // Check if message should get an auto-reply
              const shouldAutoReply = await this.aiService.shouldAutoReply(content);
              
              console.log('Should auto-reply:', shouldAutoReply);
              
              if (shouldAutoReply) {
                console.log('Generating auto-reply for user inactive for over threshold time');
                
                // Generate auto-reply
                const autoReplyContent = await this.aiService.generateAutoReply(
                  content,
                  recipient.displayName || recipient.name,
                  senderName
                );

                console.log('Auto-reply generated:', autoReplyContent);

                // Send auto-reply after a short delay (2-5 seconds to seem natural)
                const delay = 2000 + Math.random() * 3000; // 2-5 seconds
                console.log(`Sending auto-reply in ${Math.round(delay)}ms...`);
                
                setTimeout(async () => {
                  try {
                    await this.sendMessage(
                      conversationId,
                      recipientId.toString(),
                      autoReplyContent,
                      'text',
                      undefined,
                      undefined,
                      false // Auto-replies are never urgent
                    );
                    console.log('✓ Auto-reply sent successfully');
                  } catch (error) {
                    console.error('✗ Failed to send auto-reply:', error);
                  }
                }, delay);
              } else {
                console.log('Message does not warrant auto-reply');
              }
            } else {
              console.log('User has not been inactive for threshold time yet, skipping auto-reply');
            }
          } else {
            console.log('Recipient is viewing conversation, skipping auto-reply');
          }
        }
      }
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
    
    // Clear hasUrgentMessage flag and sender when messages are read
    conversation.hasUrgentMessage = false;
    conversation.urgentMessageSender = undefined;
    
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

  async markMessageAsUrgent(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You can only mark your own messages as urgent');
    }

    // Mark message as urgent
    message.isUrgent = true;
    await message.save();

    // Update conversation to show it has urgent messages
    const conversation = await this.conversationModel.findById(message.conversation);
    if (conversation) {
      conversation.hasUrgentMessage = true;
      conversation.urgentMessageSender = new Types.ObjectId(userId);
      await conversation.save();
    }

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

  async checkActiveUsers(conversationIds: string[], userId: string) {
    const activeStatus: { [conversationId: string]: { [participantId: string]: boolean } } = {};
    
    for (const conversationId of conversationIds) {
      const conversation = await this.conversationModel.findById(conversationId);
      if (conversation && conversation.participants.some(p => p.toString() === userId)) {
        activeStatus[conversationId] = {};
        
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== userId) {
            const isActive = this.chatGateway.isUserActiveInChat(
              participantId.toString(),
              conversationId,
            );
            activeStatus[conversationId][participantId.toString()] = isActive;
          }
        });
      }
    }
    
    return activeStatus;
  }

  async setChatsPageStatus(userId: string, isOnChatsPage: boolean) {
    this.chatGateway.setUserOnChatsPage(userId, isOnChatsPage);
    return { success: true };
  }

  async getConversationDocument(conversationId: string) {
    return this.conversationModel.findById(conversationId).exec();
  }
}
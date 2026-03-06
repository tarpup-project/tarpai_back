import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Broadcast } from './broadcast.schema';
import { User } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class BroadcastsService {
  constructor(
    @InjectModel(Broadcast.name) private broadcastModel: Model<Broadcast>,
    @InjectModel(User.name) private userModel: Model<User>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  async sendBroadcast(userId: string, message: string) {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (message.length > 500) {
      throw new BadRequestException('Message cannot exceed 500 characters');
    }

    const user = await this.userModel.findById(userId);
    
    if (user.followers.length === 0) {
      throw new BadRequestException('You have no followers to broadcast to');
    }

    // Check broadcast limit (365 days from first broadcast)
    const now = new Date();
    const BROADCAST_PERIOD_DAYS = 365; // 1 year
    
    // If user has a broadcast period start date, check if the period has passed
    if (user.broadcastPeriodStart) {
      const daysSinceStart = Math.floor((now.getTime() - user.broadcastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // Reset count if period has passed
      if (daysSinceStart >= BROADCAST_PERIOD_DAYS) {
        console.log(`🔄 Resetting broadcast count for user ${userId}. Days since start: ${daysSinceStart}`);
        user.yearlyBroadcastCount = 0;
        user.broadcastPeriodStart = null; // Will be set again when sending first broadcast
      }
    }

    // Check if user has reached the limit
    if (user.yearlyBroadcastCount >= 2) {
      // Calculate time remaining until reset
      const daysSinceStart = Math.floor((now.getTime() - user.broadcastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = BROADCAST_PERIOD_DAYS - daysSinceStart;
      throw new BadRequestException(`You have reached your broadcast limit of 2. You can send broadcasts again in ${daysRemaining} day(s).`);
    }

    const broadcast = new this.broadcastModel({
      sender: userId,
      message: message.trim(),
      recipients: user.followers,
      recipientCount: user.followers.length,
    });

    await broadcast.save();

    // Increment broadcast count and set period start if this is the first broadcast
    user.yearlyBroadcastCount += 1;
    if (!user.broadcastPeriodStart) {
      user.broadcastPeriodStart = now;
      console.log(`📅 Starting new broadcast period for user ${userId} at ${now.toISOString()}`);
    }
    console.log(`📊 User ${userId} broadcast count: ${user.yearlyBroadcastCount}/2`);
    await user.save();

    // Create notifications for all followers
    const recipientIds = user.followers.map(id => id.toString());
    await this.notificationsService.createBroadcastNotification(
      userId,
      recipientIds,
      message.trim(),
    );

    // Send email notifications to all followers
    const followers = await this.userModel.find({ _id: { $in: user.followers } }).select('email name displayName');
    const senderDisplayName = user.displayName || user.name;
    const senderUsername = user.username;

    // Send emails in parallel (don't wait for all to complete)
    Promise.all(
      followers.map(follower => 
        this.emailService.sendBroadcastNotification(
          follower.email,
          follower.displayName || follower.name,
          senderDisplayName,
          senderUsername,
          message.trim(),
        ).catch(err => {
          console.error(`Failed to send broadcast email to ${follower.email}:`, err);
        })
      )
    ).catch(err => {
      console.error('Error sending broadcast emails:', err);
    });

    return {
      message: 'Broadcast sent successfully',
      recipientCount: user.followers.length,
      yearlyBroadcastCount: user.yearlyBroadcastCount,
      broadcast: {
        id: broadcast._id,
        message: broadcast.message,
        createdAt: broadcast.createdAt,
      },
    };
  }

  async sendBroadcastToSelected(userId: string, message: string, userIds: string[]) {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (message.length > 500) {
      throw new BadRequestException('Message cannot exceed 500 characters');
    }

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('Please select at least one user');
    }

    const user = await this.userModel.findById(userId);
    
    // Verify all selected users are followers
    const validRecipients = userIds.filter((id) =>
      user.followers.some((followerId) => followerId.toString() === id),
    );

    if (validRecipients.length === 0) {
      throw new BadRequestException('None of the selected users are your followers');
    }

    // Check broadcast limit (365 days from first broadcast)
    const now = new Date();
    const BROADCAST_PERIOD_DAYS = 365; // 1 year
    
    // If user has a broadcast period start date, check if the period has passed
    if (user.broadcastPeriodStart) {
      const daysSinceStart = Math.floor((now.getTime() - user.broadcastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // Reset count if period has passed
      if (daysSinceStart >= BROADCAST_PERIOD_DAYS) {
        console.log(`🔄 Resetting broadcast count for user ${userId}. Days since start: ${daysSinceStart}`);
        user.yearlyBroadcastCount = 0;
        user.broadcastPeriodStart = null; // Will be set again when sending first broadcast
      }
    }

    // Check if user has reached the limit
    if (user.yearlyBroadcastCount >= 2) {
      // Calculate time remaining until reset
      const daysSinceStart = Math.floor((now.getTime() - user.broadcastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = BROADCAST_PERIOD_DAYS - daysSinceStart;
      throw new BadRequestException(`You have reached your broadcast limit of 2. You can send broadcasts again in ${daysRemaining} day(s).`);
    }

    const broadcast = new this.broadcastModel({
      sender: userId,
      message: message.trim(),
      recipients: validRecipients,
      recipientCount: validRecipients.length,
    });

    await broadcast.save();

    // Increment broadcast count and set period start if this is the first broadcast
    user.yearlyBroadcastCount += 1;
    if (!user.broadcastPeriodStart) {
      user.broadcastPeriodStart = now;
      console.log(`📅 Starting new broadcast period for user ${userId} at ${now.toISOString()}`);
    }
    console.log(`📊 User ${userId} broadcast count: ${user.yearlyBroadcastCount}/2`);
    await user.save();

    // Create notifications for selected followers
    await this.notificationsService.createBroadcastNotification(
      userId,
      validRecipients,
      message.trim(),
    );

    // Send email notifications to selected followers
    const followers = await this.userModel.find({ _id: { $in: validRecipients } }).select('email name displayName');
    const senderDisplayName = user.displayName || user.name;
    const senderUsername = user.username;

    // Send emails in parallel (don't wait for all to complete)
    Promise.all(
      followers.map(follower => 
        this.emailService.sendBroadcastNotification(
          follower.email,
          follower.displayName || follower.name,
          senderDisplayName,
          senderUsername,
          message.trim(),
        ).catch(err => {
          console.error(`Failed to send broadcast email to ${follower.email}:`, err);
        })
      )
    ).catch(err => {
      console.error('Error sending broadcast emails:', err);
    });

    return {
      message: 'Broadcast sent successfully',
      recipientCount: validRecipients.length,
      yearlyBroadcastCount: user.yearlyBroadcastCount,
      broadcast: {
        id: broadcast._id,
        message: broadcast.message,
        createdAt: broadcast.createdAt,
      },
    };
  }

  async getUserBroadcasts(userId: string) {
    const broadcasts = await this.broadcastModel
      .find({ sender: userId })
      .sort({ createdAt: -1 });

    return {
      count: broadcasts.length,
      broadcasts,
    };
  }

  async getReceivedBroadcasts(userId: string) {
    const broadcasts = await this.broadcastModel
      .find({ recipients: userId })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 });

    return {
      count: broadcasts.length,
      broadcasts,
    };
  }
}

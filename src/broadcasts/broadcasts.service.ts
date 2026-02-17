import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Broadcast } from './broadcast.schema';
import { User } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BroadcastsService {
  constructor(
    @InjectModel(Broadcast.name) private broadcastModel: Model<Broadcast>,
    @InjectModel(User.name) private userModel: Model<User>,
    private notificationsService: NotificationsService,
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

    const broadcast = new this.broadcastModel({
      sender: userId,
      message: message.trim(),
      recipients: user.followers,
      recipientCount: user.followers.length,
    });

    await broadcast.save();

    // Create notifications for all followers
    const recipientIds = user.followers.map(id => id.toString());
    await this.notificationsService.createBroadcastNotification(
      userId,
      recipientIds,
      message.trim(),
    );

    return {
      message: 'Broadcast sent successfully',
      recipientCount: user.followers.length,
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

    const broadcast = new this.broadcastModel({
      sender: userId,
      message: message.trim(),
      recipients: validRecipients,
      recipientCount: validRecipients.length,
    });

    await broadcast.save();

    // Create notifications for selected followers
    await this.notificationsService.createBroadcastNotification(
      userId,
      validRecipients,
      message.trim(),
    );

    return {
      message: 'Broadcast sent successfully',
      recipientCount: validRecipients.length,
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

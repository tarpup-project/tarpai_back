import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationType } from './notification.schema';
import { User } from '../users/user.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createBroadcastNotification(
    senderId: string,
    recipientIds: string[],
    message: string,
  ) {
    // Fetch sender's name
    const sender = await this.userModel.findById(senderId);
    const senderName = sender?.displayName || sender?.name || 'Creator';
    
    const notifications = recipientIds.map((recipientId) => ({
      recipient: new Types.ObjectId(recipientId),
      sender: new Types.ObjectId(senderId),
      type: NotificationType.BROADCAST,
      title: `Broadcast from ${senderName}`,
      message,
      isRead: false,
    }));

    await this.notificationModel.insertMany(notifications);
  }

  async createFollowNotification(followerId: string, followedUserId: string, followerName: string) {
    console.log('Creating follow notification:', { followerId, followedUserId, followerName });
    
    // Get follower's username for the profile URL
    const follower = await this.userModel.findById(followerId);
    const username = follower?.username || followerId;
    
    const notification = new this.notificationModel({
      recipient: new Types.ObjectId(followedUserId),
      sender: new Types.ObjectId(followerId),
      type: NotificationType.FOLLOW,
      title: 'New Follower',
      message: `${followerName} started following you`,
      actionUrl: `/profile/${username}`,
      actionLabel: 'View Profile',
      isRead: false,
    });

    const saved = await notification.save();
    console.log('Notification saved:', saved);
    return saved;
  }

  async createChatNotification(
    senderId: string,
    recipientId: string,
    message: string,
  ) {
    const notification = new this.notificationModel({
      recipient: new Types.ObjectId(recipientId),
      sender: new Types.ObjectId(senderId),
      type: NotificationType.CHAT_MESSAGE,
      title: 'New Message',
      message,
      actionUrl: `/chat/${senderId}`,
      actionLabel: 'View Chat',
      isRead: false,
    });

    await notification.save();
  }

  async createAdminNotification(
    recipientIds: string[],
    title: string,
    message: string,
    actionUrl?: string,
    actionLabel?: string,
  ) {
    let targetUserIds = recipientIds;

    // If no userIds provided, send to all users
    if (!recipientIds || recipientIds.length === 0) {
      const allUsers = await this.userModel.find().select('_id').exec();
      targetUserIds = allUsers.map(user => user._id.toString());
      console.log('Sending to all users:', targetUserIds.length);
    }

    console.log('Creating admin notification for:', targetUserIds.length, 'users');
    
    const notifications = targetUserIds.map((recipientId) => ({
      recipient: new Types.ObjectId(recipientId),
      type: NotificationType.ADMIN_MESSAGE,
      title,
      message,
      actionUrl,
      actionLabel,
      isRead: false,
    }));

    const result = await this.notificationModel.insertMany(notifications);
    console.log('Admin notifications created:', result.length);
    
    return result;
  }

  async getMyNotifications(userId: string, limit = 50, offset = 0) {
    console.log('Getting notifications for user:', userId, 'limit:', limit, 'offset:', offset);
    
    const notifications = await this.notificationModel
      .find({ recipient: new Types.ObjectId(userId) })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    console.log('Found notifications:', notifications.length);

    const totalCount = await this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
    });

    const unreadCount = await this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });

    console.log('Total count:', totalCount, 'Unread count:', unreadCount);

    return {
      notifications,
      unreadCount,
      totalCount,
      hasMore: offset + notifications.length < totalCount,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipient: new Types.ObjectId(userId) },
      { isRead: true },
      { new: true },
    );

    return notification;
  }

  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );

    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(userId: string, notificationId: string) {
    await this.notificationModel.findOneAndDelete({
      _id: new Types.ObjectId(notificationId),
      recipient: new Types.ObjectId(userId),
    });

    return { message: 'Notification deleted' };
  }
}

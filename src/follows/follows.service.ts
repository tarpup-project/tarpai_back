import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private notificationsService: NotificationsService,
  ) {}

  async followUser(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const currentUser = await this.userModel.findById(currentUserId);
    const targetUser = await this.userModel.findById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.following.includes(targetUser._id)) {
      throw new BadRequestException('Already following this user');
    }

    currentUser.following.push(targetUser._id);
    targetUser.followers.push(currentUser._id);

    await currentUser.save();
    await targetUser.save();

    // Create follow notification
    await this.notificationsService.createFollowNotification(
      currentUserId,
      targetUserId,
      currentUser.name,
    );

    return {
      message: 'Successfully followed user',
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
      },
    };
  }

  async unfollowUser(currentUserId: string, targetUserId: string) {
    const currentUser = await this.userModel.findById(currentUserId);
    const targetUser = await this.userModel.findById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== targetUserId,
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== currentUserId,
    );

    await currentUser.save();
    await targetUser.save();

    return { message: 'Successfully unfollowed user' };
  }

  async getFollowers(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('followers', 'name email avatar bio username displayName');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      count: user.followers.length,
      followers: user.followers,
    };
  }

  async getFollowing(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('following', 'name email avatar bio username displayName');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      count: user.following.length,
      following: user.following,
    };
  }
}

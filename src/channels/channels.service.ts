import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Channel } from './channel.schema';
import { Post } from './post.schema';
import { CloudinaryService } from '../users/cloudinary.service';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<Channel>,
    @InjectModel(Post.name) private postModel: Model<Post>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createChannel(
    userId: string,
    data: { title: string; subtitle: string },
    file?: Express.Multer.File,
  ) {
    let avatarUrl = 'https://res.cloudinary.com/dhjzwncjf/image/upload/v1771255225/Screenshot_2026-02-16_at_4.20.04_pm_paes1n.png';

    if (file) {
      avatarUrl = await this.cloudinaryService.uploadImage(file);
    }

    const channel = new this.channelModel({
      title: data.title,
      subtitle: data.subtitle,
      avatar: avatarUrl,
      owner: new Types.ObjectId(userId),
      subscribers: [],
      subscribersCount: 0,
    });

    await channel.save();

    return {
      message: 'Channel created successfully',
      channel: {
        id: channel._id,
        title: channel.title,
        subtitle: channel.subtitle,
        avatar: channel.avatar,
        subscribersCount: channel.subscribersCount,
        isOwner: true,
      },
    };
  }

  async getChannels(userId?: string) {
    const channels = await this.channelModel
      .find()
      .populate('owner', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return channels
      .filter(channel => channel.owner !== null) // Filter out channels with deleted owners
      .map(channel => ({
        id: channel._id,
        title: channel.title,
        subtitle: channel.subtitle,
        avatar: channel.avatar,
        subscribersCount: channel.subscribersCount,
        isOwner: userId ? channel.owner._id.toString() === userId : false,
        isSubscribed: userId ? channel.subscribers.some(sub => sub.toString() === userId) : false,
        owner: channel.owner,
      }));
  }

  async getMyChannels(userId: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const channels = await this.channelModel
      .find({ owner: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    return channels.map(channel => ({
      id: channel._id,
      title: channel.title,
      subtitle: channel.subtitle,
      avatar: channel.avatar,
      subscribersCount: channel.subscribersCount,
      isOwner: true,
    }));
  }

  async getChannel(channelId: string, userId?: string) {
    const channel = await this.channelModel
      .findById(channelId)
      .populate('owner', 'name username avatar')
      .exec();

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return {
      id: channel._id,
      title: channel.title,
      subtitle: channel.subtitle,
      avatar: channel.avatar,
      subscribersCount: channel.subscribersCount,
      isOwner: userId ? channel.owner._id.toString() === userId : false,
      isSubscribed: userId ? channel.subscribers.some(sub => sub.toString() === userId) : false,
      owner: channel.owner,
    };
  }

  async subscribeToChannel(channelId: string, userId: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(channelId)) {
      throw new BadRequestException('Invalid channel ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const channel = await this.channelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    
    if (channel.subscribers.some(sub => sub.toString() === userId)) {
      throw new ConflictException('Already subscribed to this channel');
    }

    channel.subscribers.push(userObjectId);
    channel.subscribersCount = channel.subscribers.length;
    await channel.save();

    return {
      message: 'Subscribed successfully',
      subscribersCount: channel.subscribersCount,
    };
  }

  async unsubscribeFromChannel(channelId: string, userId: string) {
    const channel = await this.channelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    channel.subscribers = channel.subscribers.filter(sub => sub.toString() !== userId);
    channel.subscribersCount = channel.subscribers.length;
    await channel.save();

    return {
      message: 'Unsubscribed successfully',
      subscribersCount: channel.subscribersCount,
    };
  }

  async updateChannel(
    channelId: string,
    userId: string,
    data: { title?: string; subtitle?: string },
    file?: Express.Multer.File,
  ) {
    const channel = await this.channelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.owner.toString() !== userId) {
      throw new ForbiddenException('Only channel owner can update');
    }

    if (data.title) channel.title = data.title;
    if (data.subtitle) channel.subtitle = data.subtitle;

    if (file) {
      channel.avatar = await this.cloudinaryService.uploadImage(file);
    }

    await channel.save();

    return {
      message: 'Channel updated successfully',
      channel: {
        id: channel._id,
        title: channel.title,
        subtitle: channel.subtitle,
        avatar: channel.avatar,
        subscribersCount: channel.subscribersCount,
      },
    };
  }

  async deleteChannel(channelId: string, userId: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(channelId)) {
      throw new BadRequestException('Invalid channel ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const channel = await this.channelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.owner.toString() !== userId) {
      throw new ForbiddenException('Only channel owner can delete');
    }

    // Delete all posts in this channel
    await this.postModel.deleteMany({ channel: new Types.ObjectId(channelId) });
    
    await this.channelModel.findByIdAndDelete(channelId);

    return { message: 'Channel deleted successfully' };
  }

  // Posts methods
  async createPost(channelId: string, userId: string, content: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(channelId)) {
      throw new BadRequestException('Invalid channel ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const channel = await this.channelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.owner.toString() !== userId) {
      throw new ForbiddenException('Only channel owner can post');
    }

    const post = new this.postModel({
      channel: new Types.ObjectId(channelId),
      author: new Types.ObjectId(userId),
      content,
      likes: [],
      likesCount: 0,
    });

    await post.save();

    const populatedPost = await this.postModel
      .findById(post._id)
      .populate('author', 'name username avatar')
      .exec();

    return {
      message: 'Post created successfully',
      post: {
        id: populatedPost._id,
        content: populatedPost.content,
        likesCount: populatedPost.likesCount,
        author: populatedPost.author,
        createdAt: populatedPost.createdAt,
        isLiked: false,
      },
    };
  }

  async getChannelPosts(channelId: string, userId?: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(channelId)) {
      throw new BadRequestException('Invalid channel ID format');
    }

    const posts = await this.postModel
      .find({ channel: new Types.ObjectId(channelId) })
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return posts.map(post => ({
      id: post._id,
      content: post.content,
      likesCount: post.likesCount,
      author: post.author,
      createdAt: post.createdAt,
      isLiked: userId ? post.likes.some(like => like.toString() === userId) : false,
    }));
  }

  async likePost(postId: string, userId: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (post.likes.some(like => like.toString() === userId)) {
      throw new ConflictException('Already liked this post');
    }

    post.likes.push(userObjectId);
    post.likesCount = post.likes.length;
    await post.save();

    return {
      message: 'Post liked',
      likesCount: post.likesCount,
    };
  }

  async unlikePost(postId: string, userId: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    post.likes = post.likes.filter(like => like.toString() !== userId);
    post.likesCount = post.likes.length;
    await post.save();

    return {
      message: 'Post unliked',
      likesCount: post.likesCount,
    };
  }

  async deletePost(postId: string, userId: string) {
    // Validate ObjectId formats
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const post = await this.postModel.findById(postId).populate('channel');
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const channel = await this.channelModel.findById(post.channel);
    if (channel.owner.toString() !== userId) {
      throw new ForbiddenException('Only channel owner can delete posts');
    }

    await this.postModel.findByIdAndDelete(postId);

    return { message: 'Post deleted successfully' };
  }
}

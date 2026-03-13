import { Injectable, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Status } from './status.schema';
import { User } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';
import { LinkPreviewService } from '../chat/link-preview.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class StatusService implements OnModuleInit {
  constructor(
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
    private linkPreviewService: LinkPreviewService,
  ) {}

  async onModuleInit() {
    // No cleanup needed - statuses are now filtered by age instead of deleted
    console.log('StatusService initialized - statuses filtered by age in feeds');
  }

  // Cleanup method removed - statuses are now filtered by age instead of deleted
  async cleanupOldStatuses() {
    // No longer needed - statuses persist but are filtered from feeds after 24 hours
    console.log('Status cleanup disabled - using age-based filtering instead');
  }

  async createStatus(
    userId: string,
    content: string,
    files?: Express.Multer.File[],
  ) {
    let imageUrls: string[] = [];

    if (files && files.length > 0) {
      // Upload all images to Cloudinary
      const uploadPromises = files.map(file => this.cloudinaryService.uploadImage(file));
      imageUrls = await Promise.all(uploadPromises);
    }

    // Ensure at least content or images are provided
    if (!content?.trim() && imageUrls.length === 0) {
      throw new ForbiddenException('Status must have either content or images');
    }

    // Extract and fetch link preview if content contains a URL
    let linkPreview: any = null;
    if (content) {
      const url = this.linkPreviewService.extractUrlFromMessage(content);
      if (url) {
        linkPreview = await this.linkPreviewService.fetchLinkPreview(url);
      }
    }

    const status = new this.statusModel({
      author: new Types.ObjectId(userId),
      content: content?.trim() || undefined,
      image: imageUrls.length > 0 ? imageUrls[0] : undefined, // Keep backward compatibility
      images: imageUrls,
      linkPreview: linkPreview || undefined,
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
    });

    await status.save();

    const populatedStatus = await this.statusModel
      .findById(status._id)
      .populate('author', 'name username avatar')
      .exec();

    return {
      message: 'Status posted successfully',
      status: {
        id: populatedStatus._id,
        content: populatedStatus.content,
        image: populatedStatus.image,
        images: populatedStatus.images,
        linkPreview: populatedStatus.linkPreview,
        likesCount: populatedStatus.likesCount,
        commentsCount: populatedStatus.commentsCount,
        author: populatedStatus.author,
        createdAt: populatedStatus.createdAt,
        isLiked: false,
      },
    };
  }

  async getMyStatuses(userId: string) {
    const statuses = await this.statusModel
      .find({ author: new Types.ObjectId(userId) })
      .populate('author', 'name username avatar')
      .populate({
        path: 'originalStatus',
        populate: {
          path: 'author',
          select: 'name username avatar',
        },
      })
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      linkPreview: status.linkPreview,
      isRepost: status.isRepost,
      repostContent: status.repostContent,
      originalStatus: status.originalStatus,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      repostsCount: status.repostsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: status.likes.some(like => like.toString() === userId),
      isReposted: status.reposts.some(repost => repost.toString() === userId),
    }));
  }

  async getFollowingStatuses(userId: string) {
    // Get user's following list
    const user = await this.userModel
      .findById(userId)
      .populate('following', '_id')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get following user IDs including the user themselves
    const followingIds = user.following.map(f => f._id);
    followingIds.push(new Types.ObjectId(userId)); // Include own statuses

    // Filter out statuses older than 24 hours for feeds
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const statuses = await this.statusModel
      .find({ 
        author: { $in: followingIds },
        createdAt: { $gte: twentyFourHoursAgo } // Only show statuses from last 24 hours
      })
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      linkPreview: status.linkPreview,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: status.likes.some(like => like.toString() === userId),
      isReposted: status.reposts.some(repost => repost.toString() === userId),
    }));
  }

  async getUserStatuses(userId: string, currentUserId?: string, includeOld: boolean = false) {
    let query: any = { author: new Types.ObjectId(userId) };
    
    // If not including old statuses and not viewing own profile, filter by 24 hours
    if (!includeOld && currentUserId !== userId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: twentyFourHoursAgo };
    }

    const statuses = await this.statusModel
      .find(query)
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      linkPreview: status.linkPreview,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: currentUserId ? status.likes.some(like => like.toString() === currentUserId) : false,
      isReposted: currentUserId ? status.reposts.some(repost => repost.toString() === currentUserId) : false,
    }));
  }

  async getAllStatuses(userId?: string) {
    // Filter out statuses older than 24 hours for public feeds
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const statuses = await this.statusModel
      .find({ createdAt: { $gte: twentyFourHoursAgo } }) // Only show statuses from last 24 hours
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      linkPreview: status.linkPreview,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: userId ? status.likes.some(like => like.toString() === userId) : false,
      isReposted: userId ? status.reposts.some(repost => repost.toString() === userId) : false,
    }));
  }

  async getStatus(statusId: string, userId?: string) {
    const status = await this.statusModel
      .findById(statusId)
      .populate('author', 'name username avatar')
      .populate('comments.user', 'name username avatar')
      .exec();

    if (!status) {
      throw new NotFoundException('Status not found');
    }

    return {
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      linkPreview: status.linkPreview,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: userId ? status.likes.some(like => like.toString() === userId) : false,
      isReposted: userId ? status.reposts.some(repost => repost.toString() === userId) : false,
      comments: status.comments.map((comment: any) => ({
        id: comment._id,
        content: comment.content,
        user: comment.user,
        createdAt: comment.createdAt,
      })),
    };
  }

  async likeStatus(statusId: string, userId: string) {
    const status = await this.statusModel.findById(statusId);
    if (!status) {
      throw new NotFoundException('Status not found');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (status.likes.some(like => like.toString() === userId)) {
      // Unlike if already liked
      status.likes = status.likes.filter(like => like.toString() !== userId);
    } else {
      // Like if not already liked
      status.likes.push(userObjectId);
    }

    status.likesCount = status.likes.length;
    await status.save();

    return {
      message: status.likes.some(like => like.toString() === userId) ? 'Status liked' : 'Status unliked',
      likesCount: status.likesCount,
      isLiked: status.likes.some(like => like.toString() === userId),
    };
  }

  async addComment(statusId: string, userId: string, content: string) {
    const status = await this.statusModel.findById(statusId);
    if (!status) {
      throw new NotFoundException('Status not found');
    }

    const comment = {
      user: new Types.ObjectId(userId),
      content,
      createdAt: new Date(),
    };

    status.comments.push(comment as any);
    status.commentsCount = status.comments.length;
    await status.save();

    const populatedStatus = await this.statusModel
      .findById(statusId)
      .populate('comments.user', 'name username avatar')
      .exec();

    const newComment = populatedStatus.comments[populatedStatus.comments.length - 1] as any;

    return {
      message: 'Comment added successfully',
      comment: {
        id: newComment._id,
        content: newComment.content,
        user: newComment.user,
        createdAt: newComment.createdAt,
      },
      commentsCount: status.commentsCount,
    };
  }

  async deleteStatus(statusId: string, userId: string) {
    const status = await this.statusModel.findById(statusId);
    if (!status) {
      throw new NotFoundException('Status not found');
    }

    if (status.author.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own status');
    }

    await this.statusModel.findByIdAndDelete(statusId);

    return { message: 'Status deleted successfully' };
  }

  async repostStatus(statusId: string, userId: string, repostContent?: string) {
    const originalStatus = await this.statusModel.findById(statusId);
    if (!originalStatus) {
      throw new NotFoundException('Status not found');
    }

    // Check if user already reposted this status
    const existingRepost = await this.statusModel.findOne({
      author: new Types.ObjectId(userId),
      originalStatus: new Types.ObjectId(statusId),
      isRepost: true,
    });

    if (existingRepost) {
      throw new ForbiddenException('You have already reposted this status');
    }

    // Create repost
    const repost = new this.statusModel({
      author: new Types.ObjectId(userId),
      content: originalStatus.content,
      image: originalStatus.image,
      images: originalStatus.images,
      originalStatus: new Types.ObjectId(statusId),
      isRepost: true,
      repostContent: repostContent || '',
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      reposts: [],
      repostsCount: 0,
    });

    await repost.save();

    // Update original status repost count
    originalStatus.reposts.push(new Types.ObjectId(userId));
    originalStatus.repostsCount = originalStatus.reposts.length;
    await originalStatus.save();

    const populatedRepost = await this.statusModel
      .findById(repost._id)
      .populate('author', 'name username avatar')
      .populate({
        path: 'originalStatus',
        populate: {
          path: 'author',
          select: 'name username avatar',
        },
      })
      .exec();

    return {
      message: 'Status reposted successfully',
      repost: {
        id: populatedRepost._id,
        content: populatedRepost.content,
        image: populatedRepost.image,
        images: populatedRepost.images,
        repostContent: populatedRepost.repostContent,
        isRepost: populatedRepost.isRepost,
        originalStatus: populatedRepost.originalStatus,
        likesCount: populatedRepost.likesCount,
        commentsCount: populatedRepost.commentsCount,
        repostsCount: populatedRepost.repostsCount,
        author: populatedRepost.author,
        createdAt: populatedRepost.createdAt,
        isLiked: false,
      },
    };
  }

  async editAndRepost(statusId: string, userId: string, newContent: string, files?: Express.Multer.File[]) {
    const originalStatus = await this.statusModel.findById(statusId);
    if (!originalStatus) {
      throw new NotFoundException('Status not found');
    }

    // Check if user already reposted this status
    const existingRepost = await this.statusModel.findOne({
      author: new Types.ObjectId(userId),
      originalStatus: new Types.ObjectId(statusId),
      isRepost: true,
    });

    if (existingRepost) {
      throw new ForbiddenException('You have already reposted this status');
    }

    let imageUrls: string[] = [];

    // Use original images if no new files provided
    if (files && files.length > 0) {
      const uploadPromises = files.map(file => this.cloudinaryService.uploadImage(file));
      imageUrls = await Promise.all(uploadPromises);
    } else {
      imageUrls = originalStatus.images;
    }

    // Use new content if provided and not empty, otherwise use original content or undefined
    const finalContent = newContent?.trim() ? newContent.trim() : (originalStatus.content || undefined);

    // Create edited repost
    const repost = new this.statusModel({
      author: new Types.ObjectId(userId),
      content: finalContent,
      image: imageUrls.length > 0 ? imageUrls[0] : originalStatus.image,
      images: imageUrls,
      originalStatus: new Types.ObjectId(statusId),
      isRepost: true,
      repostContent: `Edited and reposted from original`,
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      reposts: [],
      repostsCount: 0,
    });

    await repost.save();

    // Update original status repost count
    originalStatus.reposts.push(new Types.ObjectId(userId));
    originalStatus.repostsCount = originalStatus.reposts.length;
    await originalStatus.save();

    const populatedRepost = await this.statusModel
      .findById(repost._id)
      .populate('author', 'name username avatar')
      .populate({
        path: 'originalStatus',
        populate: {
          path: 'author',
          select: 'name username avatar',
        },
      })
      .exec();

    return {
      message: 'Status edited and reposted successfully',
      repost: {
        id: populatedRepost._id,
        content: populatedRepost.content,
        image: populatedRepost.image,
        images: populatedRepost.images,
        repostContent: populatedRepost.repostContent,
        isRepost: populatedRepost.isRepost,
        originalStatus: populatedRepost.originalStatus,
        likesCount: populatedRepost.likesCount,
        commentsCount: populatedRepost.commentsCount,
        repostsCount: populatedRepost.repostsCount,
        author: populatedRepost.author,
        createdAt: populatedRepost.createdAt,
        isLiked: false,
      },
    };
  }

  async deleteRepost(statusId: string, userId: string) {
    // Find the repost by original status and user
    const repost = await this.statusModel.findOne({
      author: new Types.ObjectId(userId),
      originalStatus: new Types.ObjectId(statusId),
      isRepost: true,
    });

    if (!repost) {
      throw new NotFoundException('Repost not found');
    }

    // Remove repost
    await this.statusModel.findByIdAndDelete(repost._id);

    // Update original status repost count
    const originalStatus = await this.statusModel.findById(statusId);
    if (originalStatus) {
      originalStatus.reposts = originalStatus.reposts.filter(id => id.toString() !== userId);
      originalStatus.repostsCount = originalStatus.reposts.length;
      await originalStatus.save();
    }

    return { message: 'Repost deleted successfully' };
  }

  async updateStatus(
    statusId: string,
    userId: string,
    content?: string,
    files?: Express.Multer.File[],
  ) {
    const status = await this.statusModel.findById(statusId);
    if (!status) {
      throw new NotFoundException('Status not found');
    }

    if (status.author.toString() !== userId) {
      throw new ForbiddenException('You can only update your own status');
    }

    if (content) status.content = content;

    if (files && files.length > 0) {
      const uploadPromises = files.map(file => this.cloudinaryService.uploadImage(file));
      const imageUrls = await Promise.all(uploadPromises);
      status.images = imageUrls;
      status.image = imageUrls[0]; // Keep backward compatibility
    }

    await status.save();

    const populatedStatus = await this.statusModel
      .findById(statusId)
      .populate('author', 'name username avatar')
      .exec();

    return {
      message: 'Status updated successfully',
      status: {
        id: populatedStatus._id,
        content: populatedStatus.content,
        image: populatedStatus.image,
        images: populatedStatus.images,
        likesCount: populatedStatus.likesCount,
        commentsCount: populatedStatus.commentsCount,
        author: populatedStatus.author,
        createdAt: populatedStatus.createdAt,
        isLiked: status.likes.some(like => like.toString() === userId),
      },
    };
  }
}
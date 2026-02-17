import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Status } from './status.schema';
import { User } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';

@Injectable()
export class StatusService {
  constructor(
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

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

    const status = new this.statusModel({
      author: new Types.ObjectId(userId),
      content,
      image: imageUrls.length > 0 ? imageUrls[0] : undefined, // Keep backward compatibility
      images: imageUrls,
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
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: status.likes.some(like => like.toString() === userId),
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

    const statuses = await this.statusModel
      .find({ author: { $in: followingIds } })
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: status.likes.some(like => like.toString() === userId),
    }));
  }

  async getAllStatuses(userId?: string) {
    const statuses = await this.statusModel
      .find()
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 })
      .exec();

    return statuses.map(status => ({
      id: status._id,
      content: status.content,
      image: status.image,
      images: status.images,
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: userId ? status.likes.some(like => like.toString() === userId) : false,
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
      likesCount: status.likesCount,
      commentsCount: status.commentsCount,
      author: status.author,
      createdAt: status.createdAt,
      isLiked: userId ? status.likes.some(like => like.toString() === userId) : false,
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
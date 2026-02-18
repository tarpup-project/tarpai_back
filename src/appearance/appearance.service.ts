import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Background } from './background.schema';

@Injectable()
export class AppearanceService {
  constructor(
    @InjectModel(Background.name) private backgroundModel: Model<Background>,
  ) {}

  // Admin adds background for all users
  async addAdminBackground(url: string, name?: string, thumbnail?: string, adminKey?: string) {
    // Simple admin key check
    if (adminKey !== process.env.ADMIN_KEY) {
      throw new ForbiddenException('Invalid admin key');
    }

    const background = new this.backgroundModel({
      url,
      name: name || 'Background',
      thumbnail: thumbnail || url,
      isActive: true,
      type: 'admin',
    });

    await background.save();

    return {
      message: 'Admin background added successfully',
      background: {
        id: background._id,
        url: background.url,
        thumbnail: background.thumbnail,
        name: background.name,
        type: background.type,
      },
    };
  }

  // User adds their own background
  async addUserBackground(userId: string, url: string, name?: string, thumbnail?: string) {
    const background = new this.backgroundModel({
      url,
      name: name || 'My Background',
      thumbnail: thumbnail || url,
      isActive: true,
      type: 'user',
      userId: new Types.ObjectId(userId),
    });

    await background.save();

    return {
      message: 'Background added successfully',
      background: {
        id: background._id,
        url: background.url,
        thumbnail: background.thumbnail,
        name: background.name,
        type: background.type,
      },
    };
  }

  // Get all backgrounds (admin + user's own)
  async getBackgrounds(userId?: string) {
    const query: any = { isActive: true };
    
    if (userId) {
      // Get admin backgrounds + user's own backgrounds
      query.$or = [
        { type: 'admin' },
        { type: 'user', userId: new Types.ObjectId(userId) }
      ];
    } else {
      // Only admin backgrounds if not authenticated
      query.type = 'admin';
    }

    const backgrounds = await this.backgroundModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();

    return {
      backgrounds,
      count: backgrounds.length,
    };
  }

  // Delete background (admin or user's own)
  async deleteBackground(id: string, userId?: string, adminKey?: string) {
    const background = await this.backgroundModel.findById(id);
    
    if (!background) {
      throw new NotFoundException('Background not found');
    }

    // Check if admin
    if (background.type === 'admin') {
      if (adminKey !== process.env.ADMIN_KEY) {
        throw new ForbiddenException('Only admin can delete admin backgrounds');
      }
    } else {
      // Check if user owns this background
      if (!userId || background.userId.toString() !== userId) {
        throw new ForbiddenException('You can only delete your own backgrounds');
      }
    }

    await this.backgroundModel.findByIdAndDelete(id);
    return { message: 'Background deleted successfully' };
  }

  // Update background (admin or user's own)
  async updateBackground(
    id: string, 
    data: { url?: string; name?: string; thumbnail?: string },
    userId?: string,
    adminKey?: string
  ) {
    const background = await this.backgroundModel.findById(id);
    
    if (!background) {
      throw new NotFoundException('Background not found');
    }

    console.log('Update attempt:');
    console.log('- Background type:', background.type);
    console.log('- Background userId:', background.userId);
    console.log('- Request userId:', userId);
    console.log('- Admin key provided:', !!adminKey);

    // Check if admin
    if (background.type === 'admin') {
      if (adminKey !== process.env.ADMIN_KEY) {
        throw new ForbiddenException('Only admin can update admin backgrounds');
      }
    } else {
      // Check if user owns this background
      if (!userId || background.userId.toString() !== userId) {
        console.log('Comparison failed:');
        console.log('- background.userId.toString():', background.userId?.toString());
        console.log('- userId:', userId);
        throw new ForbiddenException('You can only update your own backgrounds');
      }
    }

    const updated = await this.backgroundModel.findByIdAndUpdate(
      id,
      data,
      { new: true },
    );

    return {
      message: 'Background updated successfully',
      background: updated,
    };
  }

  // Delete all backgrounds (admin only)
  async deleteAllBackgrounds(adminKey: string) {
    if (adminKey !== process.env.ADMIN_KEY) {
      throw new ForbiddenException('Invalid admin key');
    }

    const result = await this.backgroundModel.deleteMany({});

    return {
      message: 'All backgrounds deleted successfully',
      deletedCount: result.deletedCount,
    };
  }

  // Upload background image
  async uploadUserBackground(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new NotFoundException('No file uploaded');
    }

    const cloudinary = require('cloudinary').v2;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'tarpai/backgrounds',
          public_id: `bg_${userId}_${Date.now()}`,
        },
        async (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }

          // Save to database
          const background = new this.backgroundModel({
            userId: new Types.ObjectId(userId),
            url: result.secure_url,
            name: 'My Background',
            thumbnail: result.secure_url,
            isActive: true,
            type: 'user',
          });

          await background.save();

          resolve({
            message: 'Background uploaded successfully',
            background: {
              id: background._id,
              url: background.url,
              thumbnail: background.thumbnail,
              name: background.name,
              type: background.type,
            },
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }
}

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CloudinaryService } from './cloudinary.service';
import * as QRCode from 'qrcode';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createUserDto: any): Promise<User> {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async findAll(): Promise<any[]> {
    const users = await this.userModel
      .find()
      .select('-password -verificationCode -verificationCodeExpires')
      .exec();
    
    return users.map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      isVerified: user.isVerified,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      createdAt: user.createdAt,
    }));
  }

  async findOne(id: string): Promise<any> {
    const user = await this.userModel
      .findById(id)
      .select('-password -verificationCode -verificationCodeExpires')
      .populate('followers', 'name email avatar username displayName')
      .populate('following', 'name email avatar username displayName')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user._id,
      name: user.name,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      isVerified: user.isVerified,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      createdAt: user.createdAt,
    };
  }

  async generateProfileQRCode(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate profile URL - adjust this to match your frontend URL structure
    const profileUrl = `${process.env.FRONTEND_URL || 'https://tarpai.app'}/profile/${user.username || user._id}`;
    
    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(profileUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Upload to Cloudinary
    const qrCodeUrl = await this.uploadQRCodeToCloudinary(qrCodeBuffer, userId);

    return qrCodeUrl;
  }

  private async uploadQRCodeToCloudinary(buffer: Buffer, userId: string): Promise<string> {
    const cloudinary = require('cloudinary').v2;
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'tarpai/qrcodes',
          public_id: `qr_${userId}`,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary QR upload error:', error);
            return reject(error);
          }
          resolve(result.secure_url);
        }
      );
      
      uploadStream.end(buffer);
    });
  }

  async getProfileShareData(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileUrl = `${process.env.FRONTEND_URL || 'https://tarpai.app'}/profile/${user.username || user._id}`;
    const qrCode = await this.generateProfileQRCode(userId);

    return {
      profileUrl,
      qrCode,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    };
  }

  async setupProfile(
    userId: string,
    data: { username: string; displayName: string; bio: string },
    file?: Express.Multer.File,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if username is already taken
    if (data.username) {
      const existingUser = await this.userModel.findOne({ username: data.username });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ConflictException('Username already taken');
      }
      user.username = data.username;
    }

    if (data.displayName) user.displayName = data.displayName;
    if (data.bio) user.bio = data.bio;

    if (file) {
      const avatarUrl = await this.cloudinaryService.uploadImage(file);
      user.avatar = avatarUrl;
    }

    await user.save();

    return {
      message: 'Profile setup successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
      },
    };
  }

  async updateProfile(
    userId: string,
    data?: { username?: string; displayName?: string; bio?: string },
    file?: Express.Multer.File,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if username is already taken
    if (data?.username && data.username !== user.username) {
      const existingUser = await this.userModel.findOne({ username: data.username });
      if (existingUser) {
        throw new ConflictException('Username already taken');
      }
      user.username = data.username;
    }

    if (data?.displayName !== undefined) user.displayName = data.displayName;
    if (data?.bio !== undefined) user.bio = data.bio;

    if (file) {
      const avatarUrl = await this.cloudinaryService.uploadImage(file);
      user.avatar = avatarUrl;
    }

    await user.save();

    return {
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
      },
    };
  }

  async update(id: string, updateUserDto: any): Promise<User> {
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
  }

  async remove(id: string): Promise<User> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}

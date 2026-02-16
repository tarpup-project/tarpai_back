import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CloudinaryService } from './cloudinary.service';

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

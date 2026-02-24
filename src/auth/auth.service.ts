import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.schema';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateUniqueUsername(baseName: string): Promise<string> {
    // Remove spaces and special characters, convert to lowercase
    let baseUsername = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);

    if (!baseUsername) {
      baseUsername = 'user';
    }

    // Try the base username first
    let username = baseUsername;
    let exists = await this.userModel.findOne({ username });
    
    // If exists, append random numbers until we find a unique one
    let counter = 1;
    while (exists) {
      const randomNum = Math.floor(Math.random() * 9999);
      username = `${baseUsername}${randomNum}`;
      exists = await this.userModel.findOne({ username });
      counter++;
      
      // Safety check to prevent infinite loop
      if (counter > 100) {
        username = `${baseUsername}${Date.now()}`;
        break;
      }
    }

    return username;
  }

  async signup(name: string, email: string, password: string) {
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const username = await this.generateUniqueUsername(name);

    const user = new this.userModel({
      name,
      email,
      password: hashedPassword,
      username,
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
    });

    await user.save();
    await this.emailService.sendVerificationEmail(email, verificationCode);

    return {
      message: 'Verification code sent to your email',
      email: user.email,
    };
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    if (user.verificationCodeExpires < new Date()) {
      throw new BadRequestException('Verification code expired');
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = this.jwtService.sign({ id: user._id, email: user.email });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        displayName: user.displayName,
        username: user.username,
      },
    };
  }

  async resendVerificationCode(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    await this.emailService.sendVerificationEmail(email, verificationCode);

    return {
      message: 'Verification code resent to your email',
    };
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ id: user._id, email: user.email });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        displayName: user.displayName,
        username: user.username,
      },
    };
  }

  async googleLogin(profile: any) {
    let user = await this.userModel.findOne({ email: profile.email });

    if (!user) {
      const username = await this.generateUniqueUsername(profile.name);
      user = new this.userModel({
        name: profile.name,
        email: profile.email,
        password: '',
        username,
        isVerified: true,
        avatar: profile.avatar,
      });
      await user.save();
    }

    const token = this.jwtService.sign({ id: user._id, email: user.email });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        displayName: user.displayName,
        username: user.username,
      },
    };
  }
}

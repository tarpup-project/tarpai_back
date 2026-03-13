import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.schema';
import { EmailService } from './email.service';
import { FollowsService } from '../follows/follows.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
    @Inject(forwardRef(() => FollowsService))
    private followsService: FollowsService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

  async silentSignup(
    name: string, 
    email: string, 
    password: string,
    source?: string,
    referrerId?: string
  ) {
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = await this.generateUniqueUsername(name);

    const user = new this.userModel({
      name,
      email,
      password: hashedPassword,
      username,
      isVerified: true, // Auto-verify silent signups
      isSilentSignup: true,
      silentSignupSource: source,
      silentSignupReferrer: referrerId,
    });

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
      // Ensure name is not null or empty
      const name = profile.name || profile.email?.split('@')[0] || 'User';
      const username = await this.generateUniqueUsername(name);
      
      user = new this.userModel({
        name: name,
        displayName: name,
        email: profile.email,
        password: '',
        username,
        isVerified: true,
        avatar: profile.avatar || 'https://res.cloudinary.com/dhjzwncjf/image/upload/v1771255225/Screenshot_2026-02-16_at_4.20.04_pm_paes1n.png',
      });
      await user.save();
    } else {
      // If user exists and logs in with Google, upgrade them to a normal user
      // Clear silent signup status since they've now authenticated properly
      if (user.isSilentSignup) {
        user.isSilentSignup = false;
        // Keep the source and referrer for analytics, but mark them as no longer silent
      }
      
      // Update name if it's missing
      if (!user.name) {
        user.name = profile.name || profile.email?.split('@')[0] || 'User';
      }
      
      // Update displayName if it's missing
      if (!user.displayName) {
        user.displayName = user.name;
      }
      
      // Update avatar if they don't have one or have the default avatar
      if (!user.avatar || user.avatar === 'https://res.cloudinary.com/dhjzwncjf/image/upload/v1771255225/Screenshot_2026-02-16_at_4.20.04_pm_paes1n.png') {
        user.avatar = profile.avatar || user.avatar;
      }
      
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
  async createPendingUser(
      name: string, 
      email: string, 
      recipientId: string,
      messageContent: string
    ) {
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      const verificationToken = this.generateVerificationToken();
      const verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const username = await this.generateUniqueUsername(name);

      const user = new this.userModel({
        name,
        email,
        password: '', // No password for pending users
        username,
        isVerified: false,
        verificationToken,
        verificationCodeExpires,
        pendingMessages: [{
          recipientId,
          content: messageContent,
          createdAt: new Date()
        }]
      });

      await user.save();

      // Get recipient info for email
      const recipient = await this.userModel.findById(recipientId);
      if (!recipient) {
        throw new BadRequestException('Recipient not found');
      }

      await this.emailService.sendChatVerificationLink(
        email, 
        verificationToken,
        recipientId,
        name, 
        recipient.displayName || recipient.name,
        messageContent
      );

      return {
        message: 'Verification email sent. Please check your email to complete registration and send your message.',
        email: user.email,
      };
    }

  async verifyEmailAndSendPendingMessages(email: string, code: string) {
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

      // Store pending messages before clearing them
      const pendingMessages = [...user.pendingMessages];

      // Verify the user
      user.isVerified = true;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;

      // Generate a random password for the user
      const randomPassword = Math.random().toString(36).slice(-12);
      user.password = await bcrypt.hash(randomPassword, 10);

      // Clear pending messages
      user.pendingMessages = [];
      await user.save();

      console.log(`User ${user._id} verified with ${pendingMessages.length} pending messages`);

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
        message: 'Email verified successfully! You can now start chatting.',
        pendingMessages: pendingMessages, // Return pending messages to frontend
      };
    }
  async verifyEmailWithToken(token: string, recipientId: string) {
    const user = await this.userModel.findOne({ verificationToken: token });
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.verificationCodeExpires < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    // Store pending messages before clearing them
    const pendingMessages = [...user.pendingMessages];

    // Verify the user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationCodeExpires = undefined;

    // Generate a random password for the user
    const randomPassword = Math.random().toString(36).slice(-12);
    user.password = await bcrypt.hash(randomPassword, 10);

    // Clear pending messages
    user.pendingMessages = [];
    await user.save();

    console.log(`User ${user._id} verified with token, ${pendingMessages.length} pending messages`);

    const jwtToken = this.jwtService.sign({ id: user._id, email: user.email });

    return {
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        displayName: user.displayName,
        username: user.username,
      },
      pendingMessages: pendingMessages,
      recipientId: recipientId,
      message: 'Email verified successfully! Setting up your chat...',
    };
  }

  async createPendingProfileUser(
    name: string, 
    email: string, 
    profileUserId: string,
    action: 'follow' | 'followers' | 'following' | 'view_status' | 'chat',
    profileUsername: string,
    statusId?: string
  ) {
    console.log('=== createPendingProfileUser called ===');
    console.log('name:', name);
    console.log('email:', email);
    console.log('profileUserId:', profileUserId);
    console.log('action:', action);
    console.log('profileUsername:', profileUsername);
    console.log('statusId:', statusId);
    
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const verificationToken = this.generateVerificationToken();
    const verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const username = await this.generateUniqueUsername(name);

    const user = new this.userModel({
      name,
      email,
      password: '', // No password for pending users
      username,
      isVerified: false,
      verificationToken,
      verificationCodeExpires,
      pendingProfileAction: {
        profileUserId,
        action,
        profileUsername,
        statusId: statusId || undefined,
        createdAt: new Date()
      }
    });

    await user.save();

    // Get profile user info for email
    const profileUser = await this.userModel.findById(profileUserId);
    if (!profileUser) {
      throw new BadRequestException('Profile user not found');
    }

    // Send verification email to the requester
    await this.emailService.sendProfileVerificationLink(
      email, 
      verificationToken,
      profileUserId,
      name, 
      profileUser.displayName || profileUser.name,
      action,
      profileUsername,
      statusId
    );

    // Send notification email to the existing user (profile owner) if action is chat-related
    if (action === 'chat' || action === 'follow') {
      try {
        await this.emailService.sendChatRequestNotification(
          profileUser.email,
          profileUser.displayName || profileUser.name,
          name,
          email
        );
        console.log('Chat request notification sent to profile user:', profileUser.email);
      } catch (error) {
        console.error('Failed to send chat request notification:', error);
        // Don't fail the main flow if notification fails
      }
    }

    return {
      message: 'Verification email sent. Please check your email to complete the action.',
      email: user.email,
    };
  }

  async verifyProfileAction(token: string, profileUserId: string) {
    console.log('=== verifyProfileAction called ===');
    console.log('token:', token);
    console.log('profileUserId:', profileUserId);
    
    const user = await this.userModel.findOne({ verificationToken: token });
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.verificationCodeExpires < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    // Store pending action before clearing it
    const pendingAction = user.pendingProfileAction;
    console.log('pendingAction from database:', pendingAction);

    // Verify the user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationCodeExpires = undefined;

    // Generate a random password for the user
    const randomPassword = Math.random().toString(36).slice(-12);
    user.password = await bcrypt.hash(randomPassword, 10);

    // Clear pending action
    user.pendingProfileAction = undefined;
    await user.save();

    console.log(`User ${user._id} verified with profile action:`, pendingAction);

    const jwtToken = this.jwtService.sign({ id: user._id, email: user.email });

    return {
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        displayName: user.displayName,
        username: user.username,
      },
      pendingAction: pendingAction,
      message: 'Email verified successfully! Completing your action...',
    };
  }

  async sendLoginLinkForProfileAction(
    email: string,
    profileUserId: string,
    action: string,
    profileUsername: string,
  ) {
    console.log('=== sendLoginLinkForProfileAction called ===');
    console.log('email:', email);
    console.log('profileUserId:', profileUserId);
    console.log('action:', action);
    
    // Find existing user by email
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('No account found with this email');
    }

    // Get profile user info for notifications
    const profileUser = await this.userModel.findById(profileUserId);
    if (!profileUser) {
      throw new BadRequestException('Profile user not found');
    }

    // Check if user is already verified
    if (user.isVerified) {
      // User is already verified, perform the action directly
      console.log('User already verified, performing action directly');
      
      // Generate JWT token for the user
      const jwtToken = this.jwtService.sign({ id: user._id, email: user.email });
      
      // Perform the action based on type
      let actionResult = null;
      if (action === 'follow') {
        // Use follows service to follow the user
        try {
          await this.followsService.followUser(user._id.toString(), profileUserId);
          console.log(`User ${user._id} followed ${profileUserId}`);
          actionResult = 'followed';
        } catch (error) {
          console.log('Follow action error (may already be following):', error.message);
          // If already following, just log in without error
          if (error.message?.includes('Already following')) {
            actionResult = 'already_following';
          }
        }
      }
      
      // Send notification to profile user for chat-related actions
      if (action === 'chat' || action === 'follow') {
        try {
          await this.emailService.sendChatRequestNotification(
            profileUser.email,
            profileUser.displayName || profileUser.name,
            user.displayName || user.name,
            user.email
          );
          console.log('Chat request notification sent to profile user:', profileUser.email);
        } catch (error) {
          console.error('Failed to send chat request notification:', error);
          // Don't fail the main flow if notification fails
        }
      }
      
      return {
        token: jwtToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          isVerified: user.isVerified,
        },
        message: 'Logged in successfully',
        actionPerformed: action,
        actionResult: actionResult,
      };
    }

    // User not verified yet, send verification email
    const token = this.generateVerificationToken();
    user.verificationToken = token;
    user.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store pending action with proper structure
    user.pendingProfileAction = {
      profileUserId: profileUserId as any,
      action: action as any,
      profileUsername: profileUsername,
      createdAt: new Date(),
    };
    
    await user.save();

    // Send login email using the profile verification link method
    await this.emailService.sendProfileVerificationLink(
      email,
      token,
      profileUserId,
      user.name,
      profileUsername,
      action as any,
      profileUsername,
    );

    // Send notification to profile user for chat-related actions
    if (action === 'chat' || action === 'follow') {
      try {
        await this.emailService.sendChatRequestNotification(
          profileUser.email,
          profileUser.displayName || profileUser.name,
          user.displayName || user.name,
          user.email
        );
        console.log('Chat request notification sent to profile user:', profileUser.email);
      } catch (error) {
        console.error('Failed to send chat request notification:', error);
        // Don't fail the main flow if notification fails
      }
    }

    return {
      message: 'Login link sent to your email',
    };
  }

  async connectGoogleCalendar(code: string, userId: string) {
    console.log('connectGoogleCalendar called with userId:', userId);
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    try {
      const axios = require('axios');
      
      console.log('Exchanging code for tokens...');
      
      // Exchange authorization code for tokens using calendar-specific credentials
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri: `${process.env.FRONTEND_URL}/auth/google/calendar/callback`,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;
      
      console.log('Tokens received, saving to user:', userId);

      // Store tokens in user document
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        {
          googleCalendarAccessToken: access_token,
          googleCalendarRefreshToken: refresh_token,
          googleCalendarTokenExpiry: new Date(Date.now() + expires_in * 1000),
        },
        { new: true }
      );

      console.log('Calendar tokens saved successfully for user:', userId);
      console.log('Has access token:', !!updatedUser.googleCalendarAccessToken);

      return {
        message: 'Calendar connected successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error connecting Google Calendar:', error.response?.data || error.message);
      throw new BadRequestException('Failed to connect Google Calendar: ' + (error.response?.data?.error_description || error.message));
    }
  }
}

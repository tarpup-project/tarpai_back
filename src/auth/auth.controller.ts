import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() body: { name: string; email: string; password: string },
  ) {
    return this.authService.signup(body.name, body.email, body.password);
  }

  @Post('silent-signup')
  async silentSignup(
    @Body() body: { 
      name: string; 
      email: string; 
      password: string;
      source?: string;
      referrerId?: string;
    },
  ) {
    return this.authService.silentSignup(
      body.name, 
      body.email, 
      body.password,
      body.source,
      body.referrerId
    );
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmail(body.email, body.code);
  }

  @Post('resend-code')
  async resendCode(@Body() body: { email: string }) {
    return this.authService.resendVerificationCode(body.email);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    const result = await this.authService.googleLogin(req.user);
    
    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/google/callback?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  }
  @Post('create-pending-user')
  async createPendingUser(
    @Body() body: {
      name: string;
      email: string;
      recipientId: string;
      messageContent: string;
    },
  ) {
    return this.authService.createPendingUser(
      body.name,
      body.email,
      body.recipientId,
      body.messageContent
    );
  }

  @Post('verify-and-send-messages')
  async verifyAndSendMessages(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmailAndSendPendingMessages(body.email, body.code);
  }
  @Post('verify-chat-token')
  async verifyChatToken(@Body() body: { token: string; recipientId: string }) {
    return this.authService.verifyEmailWithToken(body.token, body.recipientId);
  }

  @Post('create-pending-profile-user')
  async createPendingProfileUser(
    @Body() body: {
      name: string;
      email: string;
      profileUserId: string;
      action: 'follow' | 'followers' | 'following' | 'view_status' | 'chat';
      profileUsername: string;
      statusId?: string;
    },
  ) {
    return this.authService.createPendingProfileUser(
      body.name,
      body.email,
      body.profileUserId,
      body.action,
      body.profileUsername,
      body.statusId
    );
  }

  @Post('verify-profile-token')
  async verifyProfileToken(@Body() body: { token: string; profileUserId: string }) {
    return this.authService.verifyProfileAction(body.token, body.profileUserId);
  }

  @Post('send-login-link')
  async sendLoginLink(
    @Body() body: {
      email: string;
      profileUserId: string;
      action: string;
      profileUsername: string;
    },
  ) {
    return this.authService.sendLoginLinkForProfileAction(
      body.email,
      body.profileUserId,
      body.action,
      body.profileUsername,
    );
  }

  @Post('google/calendar')
  @UseGuards(AuthGuard('jwt'))
  async connectGoogleCalendar(
    @Body() body: { code: string },
    @Req() req: any,
  ) {
    // Try different possible user ID fields
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    console.log('Calendar connect - req.user:', req.user);
    console.log('Calendar connect - userId:', userId);
    return this.authService.connectGoogleCalendar(body.code, userId);
  }
}

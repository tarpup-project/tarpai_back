import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private configService: ConfigService) {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
    const emailService = this.configService.get<string>('EMAIL_SERVICE') || 'gmail';
    const emailHost = this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com';
    const emailPort = this.configService.get<number>('EMAIL_PORT') || 587;

    console.log('Email service configuration:', {
      service: emailService,
      host: emailHost,
      port: emailPort,
      user: emailUser ? `${emailUser.substring(0, 3)}***` : 'not set',
      hasPassword: !!emailPassword
    });

    if (emailUser && emailPassword) {
      // Production-ready configuration with fallback to Gmail
      if (emailService === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000,  
          socketTimeout: 30000,
          debug: process.env.NODE_ENV === 'development',
          logger: process.env.NODE_ENV === 'development',
        } as any);
      } else {
        // Manual SMTP configuration for other services
        this.transporter = nodemailer.createTransport({
          host: emailHost,
          port: emailPort,
          secure: emailPort === 465,
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 30000,
          debug: process.env.NODE_ENV === 'development',
          logger: process.env.NODE_ENV === 'development',
        } as any);
      }
    }
  }

  async sendVerificationEmail(email: string, code: string) {
    if (!this.transporter) {
      console.log('Email not configured. VERIFICATION CODE:', code);
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: email,
      subject: 'Verify Your Email - TarpAI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to TarpAI!</h2>
          <p>Your verification code is:</p>
          <h1 style="background: #f4f4f4; padding: 20px; text-align: center; letter-spacing: 5px;">
            ${code}
          </h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent to:', email);
    } catch (error) {
      console.error('Error sending email:', error);
      console.log('VERIFICATION CODE:', code);
    }
  }

  async sendChatReplyNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    messageContent: string,
    conversationId: string,
  ) {
    console.log('=== sendChatReplyNotification called ===');
    console.log('Recipient Email:', recipientEmail);
    console.log('Recipient Name:', recipientName);
    console.log('Sender Name:', senderName);
    console.log('Message Content:', messageContent);
    console.log('Conversation ID:', conversationId);
    console.log('Transporter configured:', !!this.transporter);
    
    if (!this.transporter) {
      console.log('Email not configured. Chat reply notification not sent.');
      return;
    }

    // const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    console.log('Backend URL:', backendUrl);
    // const chatUrl = `${frontendUrl}/chat/${conversationId}`;
    const googleAuthUrl = `${backendUrl}/auth/google`;
    console.log('Google Auth URL:', googleAuthUrl);

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com';
    console.log('Email From:', emailFrom);
    console.log('Email To:', recipientEmail);
    
    const mailOptions = {
      from: emailFrom,
      to: recipientEmail,
      subject: `${senderName} sent you a message on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${recipientName}! 👋</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> replied to your message:
            </p>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px;">
              <p style="color: #333; margin: 0; font-style: italic;">
                "${messageContent.length > 150 ? messageContent.substring(0, 150) + '...' : messageContent}"
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${googleAuthUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                View Message
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center;">
              <p style="color: #666; margin-bottom: 15px;">
                Want a better experience? Sign in with Google for instant access!
              </p>
              <a href="${googleAuthUrl}" style="background: white; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; border: 2px solid #ddd; font-weight: 500;">
                <img src="https://www.google.com/favicon.ico" alt="Google" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 8px;">
                Sign in with Google
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because someone sent you a message on TarpUp.
            </p>
          </div>
        </div>
      `,
    };

    console.log('Attempting to send email...');
    console.log('Mail options:', JSON.stringify({
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    }));
    
    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Chat reply notification sent successfully to:', recipientEmail);
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending chat reply notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }

  async sendUrgentMessageNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    messageContent: string,
    conversationId: string,
  ) {
    console.log('=== sendUrgentMessageNotification called ===');
    console.log('Recipient Email:', recipientEmail);
    console.log('Recipient Name:', recipientName);
    console.log('Sender Name:', senderName);
    console.log('Message Content:', messageContent);
    
    // Skip email in development if there are connectivity issues
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_EMAIL) {
      console.log('Skipping email notification in development mode');
      console.log('Set FORCE_EMAIL=true in .env to enable emails in development');
      return;
    }
    
    if (!this.transporter) {
      console.log('Email not configured. Urgent message notification not sent.');
      return;
    }

    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const chatUrl = `${frontendUrl}/chat/${conversationId}`;
    const googleAuthUrl = `${backendUrl}/auth/google`;

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com';
    
    const mailOptions = {
      from: emailFrom,
      to: recipientEmail,
      subject: `🚨 Urgent Message from ${senderName} on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🚨 Urgent Message</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 3px solid #ff6b6b;">
            <h2 style="color: #333; margin-top: 0;">Hi ${recipientName}! ⚠️</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> sent you an <strong style="color: #ff6b6b;">URGENT</strong> message:
            </p>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #ff6b6b; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #333; margin: 0; font-size: 16px; font-weight: 500;">
                "${messageContent.length > 200 ? messageContent.substring(0, 200) + '...' : messageContent}"
              </p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                ⚡ This message was flagged as urgent by our AI. Please respond as soon as possible.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${chatUrl}" style="background: #ff6b6b; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                View & Respond Now
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center;">
              <p style="color: #666; margin-bottom: 15px;">
                Not signed in? Access your messages instantly with Google
              </p>
              <a href="${googleAuthUrl}" style="background: white; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; border: 2px solid #ddd; font-weight: 500;">
                <img src="https://www.google.com/favicon.ico" alt="Google" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 8px;">
                Sign in with Google
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because an urgent message was sent to you on TarpUp.
            </p>
          </div>
        </div>
      `,
    };

    console.log('Attempting to send urgent email...');
    
    try {
      // Test connection first
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Urgent message notification sent successfully to:', recipientEmail);
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending urgent message notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Log specific error information
      if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
        console.error('Network connectivity issue. Check:');
        console.error('1. Internet connection');
        console.error('2. Firewall settings');
        console.error('3. DNS resolution for smtp.gmail.com');
        console.error('4. Gmail SMTP settings');
      }
      
      // Don't throw the error to prevent breaking the chat flow
      // The message was still sent successfully, just the email notification failed
    }
  }

  // Generic method to send any email
  async sendEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      console.log('Email not configured. Email not sent.');
      return;
    }

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com';
    
    const mailOptions = {
      from: emailFrom,
      to,
      subject,
      html,
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully to:', to);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
  async sendChatVerificationEmail(email: string, code: string, recipientName: string, senderName: string, messageContent: string) {
    if (!this.transporter) {
      console.log('Email not configured. VERIFICATION CODE:', code);
      return;
    }

    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const googleAuthUrl = `${backendUrl}/auth/google`;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: email,
      subject: `${senderName} wants to chat with you on TarpUp - Verify your email`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${recipientName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> wants to send you a message:
            </p>

            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px;">
              <p style="color: #333; margin: 0; font-style: italic;">
                "${messageContent.length > 150 ? messageContent.substring(0, 150) + '...' : messageContent}"
              </p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                📧 Please verify your email to receive this message and start chatting!
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #666; margin-bottom: 15px;">Your verification code is:</p>
              <h1 style="background: #f4f4f4; padding: 20px; text-align: center; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
                ${code}
              </h1>
              <p style="color: #999; font-size: 12px;">This code will expire in 10 minutes.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center;">
              <p style="color: #666; margin-bottom: 15px;">
                Or verify instantly with Google and start chatting right away!
              </p>
              <a href="${googleAuthUrl}" style="background: white; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; border: 2px solid #ddd; font-weight: 500;">
                <img src="https://www.google.com/favicon.ico" alt="Google" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 8px;">
                Verify with Google
              </a>
            </div>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because someone wants to chat with you on TarpUp.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Chat verification email sent to:', email);
    } catch (error) {
      console.error('Error sending chat verification email:', error);
      console.log('VERIFICATION CODE:', code);
    }
  }
  async sendChatVerificationLink(
    email: string,
    token: string,
    recipientId: string,
    senderName: string,
    recipientName: string,
    messageContent: string
  ) {
    if (!this.transporter) {
      console.log('Email not configured. VERIFICATION TOKEN:', token);
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const verificationUrl = `${frontendUrl}/verify-chat?token=${token}&recipientId=${recipientId}`;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: email,
      subject: `${recipientName} wants to chat with you on TarpUp - Click to verify`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${senderName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${recipientName}</strong> wants to receive your message:
            </p>

            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px;">
              <p style="color: #333; margin: 0; font-style: italic;">
                "${messageContent.length > 150 ? messageContent.substring(0, 150) + '...' : messageContent}"
              </p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                📧 Click the button below to verify your email and send your message!
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                Verify Email & Send Message
              </a>
            </div>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              This link will expire in 24 hours.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this because someone wants to chat with you on TarpUp.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Chat verification link sent to:', email);
    } catch (error) {
      console.error('Error sending chat verification link:', error);
      console.log('VERIFICATION TOKEN:', token);
    }
  }

  async sendFirstMessageNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    messageContent: string,
    conversationId: string
  ) {
    if (!this.transporter) {
      console.log('Email not configured. First message notification not sent.');
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const chatUrl = `${frontendUrl}/chat/${conversationId}`;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: recipientEmail,
      subject: `${senderName} sent you a message on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${recipientName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> sent you a message:
            </p>

            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px;">
              <p style="color: #333; margin: 0; font-style: italic;">
                "${messageContent.length > 200 ? messageContent.substring(0, 200) + '...' : messageContent}"
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${chatUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                Reply to ${senderName}
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this because ${senderName} sent you their first message on TarpUp.<br>
              You can manage your notification preferences in your account settings.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('First message notification sent to:', recipientEmail);
    } catch (error) {
      console.error('Error sending first message notification:', error);
    }
  }

  async sendChatRequestNotification(
    existingUserEmail: string,
    existingUserName: string,
    requesterName: string,
    requesterEmail: string
  ) {
    if (!this.transporter) {
      console.log('Email not configured. Chat request notification not sent.');
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: existingUserEmail,
      subject: `${requesterName} wants to chat with you on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${existingUserName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${requesterName}</strong> (${requesterEmail}) wants to chat with you on TarpUp!
            </p>

            <div style="background: #e7f3ff; padding: 20px; border-left: 4px solid #2196F3; margin: 20px 0; border-radius: 5px;">
              <p style="color: #333; margin: 0;">
                💬 They're going through the verification process to send you a message. You'll receive their message once they verify their email.
              </p>
            </div>

            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #333; margin: 0; font-size: 14px;">
                📱 You can check your TarpUp messages anytime by logging into your account.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this notification because someone wants to chat with you on TarpUp.<br>
              This is just a heads up - no action is required from you.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Chat request notification sent to:', existingUserEmail);
    } catch (error) {
      console.error('Error sending chat request notification:', error);
    }
  }

  async sendProfileVerificationLink(
    email: string,
    token: string,
    profileUserId: string,
    senderName: string,
    profileName: string,
    action: 'follow' | 'followers' | 'following' | 'view_status' | 'chat',
    profileUsername: string,
    statusId?: string
  ) {
    if (!this.transporter) {
      console.log('Email not configured. VERIFICATION TOKEN:', token);
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const verificationUrl = statusId 
      ? `${frontendUrl}/verify-profile?token=${token}&profileUserId=${profileUserId}&action=${action}&profileUsername=${profileUsername}&statusId=${statusId}`
      : `${frontendUrl}/verify-profile?token=${token}&profileUserId=${profileUserId}&action=${action}&profileUsername=${profileUsername}`;

    const actionText = {
      follow: 'follow',
      followers: 'view followers of',
      following: 'view following of',
      view_status: 'view status from',
      chat: 'chat with'
    };

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: email,
      subject: `Complete your action on ${profileName}'s profile - TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${senderName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You wanted to <strong>${actionText[action]} ${profileName}</strong> on TarpUp.
            </p>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                📧 Click the button below to verify your email and complete this action!
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                Verify Email & ${action === 'follow' ? 'Follow' : action === 'followers' ? 'View Followers' : action === 'following' ? 'View Following' : action === 'view_status' ? 'View Status' : 'Start Chat'}
              </a>
            </div>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              This link will expire in 24 hours.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this because you requested to ${actionText[action]} ${profileName} on TarpUp.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Profile verification link sent to:', email);
    } catch (error) {
      console.error('Error sending profile verification link:', error);
      console.log('VERIFICATION TOKEN:', token);
    }
  }

  async sendUrgentReplyNotification(
    originalSenderEmail: string,
    originalSenderName: string,
    replierName: string,
    replyContent: string,
    originalMessageContent: string,
    conversationId: string,
  ) {
    console.log('=== sendUrgentReplyNotification called ===');
    console.log('Original Sender Email:', originalSenderEmail);
    console.log('Original Sender Name:', originalSenderName);
    console.log('Replier Name:', replierName);
    console.log('Reply Content:', replyContent);
    
    if (!this.transporter) {
      console.log('Email not configured. Urgent reply notification not sent.');
      return;
    }

    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const chatUrl = `${frontendUrl}/chat/${conversationId}`;
    const googleAuthUrl = `${backendUrl}/auth/google`;

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com';
    
    const mailOptions = {
      from: emailFrom,
      to: originalSenderEmail,
      subject: `✅ ${replierName} replied to your urgent message on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Reply Received</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 3px solid #28a745;">
            <h2 style="color: #333; margin-top: 0;">Hi ${originalSenderName}! 🎉</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Great news! <strong>${replierName}</strong> replied to your urgent message:
            </p>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p style="color: #155724; margin: 0; font-size: 14px; font-weight: 500;">
                📩 Your original urgent message:
              </p>
              <p style="color: #333; margin: 10px 0 0 0; font-style: italic;">
                "${originalMessageContent.length > 100 ? originalMessageContent.substring(0, 100) + '...' : originalMessageContent}"
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #155724; margin: 0 0 10px 0; font-size: 14px; font-weight: 500;">
                💬 ${replierName}'s reply:
              </p>
              <p style="color: #333; margin: 0; font-size: 16px;">
                "${replyContent.length > 200 ? replyContent.substring(0, 200) + '...' : replyContent}"
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${chatUrl}" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                Continue Conversation
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center;">
              <p style="color: #666; margin-bottom: 15px;">
                Not signed in? Access your messages instantly with Google
              </p>
              <a href="${googleAuthUrl}" style="background: white; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; border: 2px solid #ddd; font-weight: 500;">
                <img src="https://www.google.com/favicon.ico" alt="Google" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 8px;">
                Sign in with Google
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because someone replied to your urgent message on TarpUp.
            </p>
          </div>
        </div>
      `,
    };

    console.log('Attempting to send urgent reply notification email...');
    
    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Urgent reply notification sent successfully to:', originalSenderEmail);
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending urgent reply notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }

  async sendBroadcastNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    senderUsername: string,
    broadcastMessage: string,
  ) {
    console.log('=== sendBroadcastNotification called ===');
    console.log('Recipient Email:', recipientEmail);
    console.log('Recipient Name:', recipientName);
    console.log('Sender Name:', senderName);
    console.log('Broadcast Message:', broadcastMessage);
    
    if (!this.transporter) {
      console.log('Email not configured. Broadcast notification not sent.');
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const broadcastsUrl = `${frontendUrl}/chats?tab=broadcasts`;
    const senderProfileUrl = `${frontendUrl}/${senderUsername}`;

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com';
    
    const mailOptions = {
      from: emailFrom,
      to: recipientEmail,
      subject: `📢 ${senderName} sent you a broadcast on TarpUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">📢 TarpUp Broadcast</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${recipientName}! 👋</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> sent a broadcast message to all followers:
            </p>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #333; margin: 0; font-size: 15px; line-height: 1.6;">
                ${broadcastMessage.length > 300 ? broadcastMessage.substring(0, 300) + '...' : broadcastMessage}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${broadcastsUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                View All Broadcasts
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center;">
              <p style="color: #666; margin-bottom: 15px;">
                Want to see more from ${senderName}?
              </p>
              <a href="${senderProfileUrl}" style="background: white; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; border: 2px solid #ddd; font-weight: 500;">
                Visit @${senderUsername}'s Profile
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because you follow ${senderName} on TarpUp.<br>
              Broadcasts are limited to 2 per year per user.
            </p>
          </div>
        </div>
      `,
    };

    console.log('Attempting to send broadcast notification email...');
    
    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Broadcast notification sent successfully to:', recipientEmail);
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }

  async sendFeedbackEmail(adminEmail: string, feedbackDetails: string) {
    if (!this.transporter) {
      console.log('Email not configured. Feedback details:', feedbackDetails);
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@tarpai.com',
      to: adminEmail,
      subject: 'New Feedback Received - TarpUp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">TarpUp</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">New Feedback Received</h2>
            
            <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea;">
              ${feedbackDetails}
            </div>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              This is an automated notification from TarpUp feedback system.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Feedback email sent successfully to:', adminEmail);
    } catch (error) {
      console.error('Error sending feedback email:', error);
    }
  }

  async testEmailConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Email not configured' };
    }

    try {
      await this.transporter.verify();
      console.log('Email connection test successful');
      return { success: true };
    } catch (error) {
      console.error('Email connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

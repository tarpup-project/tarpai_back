import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private configService: ConfigService) {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

    if (emailUser && emailPassword) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
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
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Urgent message notification sent successfully to:', recipientEmail);
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending urgent message notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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

  async sendProfileVerificationLink(
    email: string,
    token: string,
    profileUserId: string,
    senderName: string,
    profileName: string,
    action: 'follow' | 'followers' | 'following',
    profileUsername: string
  ) {
    if (!this.transporter) {
      console.log('Email not configured. VERIFICATION TOKEN:', token);
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const verificationUrl = `${frontendUrl}/verify-profile?token=${token}&profileUserId=${profileUserId}&action=${action}&profileUsername=${profileUsername}`;

    const actionText = {
      follow: 'follow',
      followers: 'view followers of',
      following: 'view following of'
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
                Verify Email & ${action === 'follow' ? 'Follow' : action === 'followers' ? 'View Followers' : 'View Following'}
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
}

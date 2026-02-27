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
}

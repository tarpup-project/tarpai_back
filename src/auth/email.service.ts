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
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reminder } from './reminder.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../auth/email.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectModel(Reminder.name) private reminderModel: Model<Reminder>,
    private emailService: EmailService,
  ) {}

  async createReminder(
    userId: string,
    title: string,
    description: string,
    email: string,
    scheduledFor: Date,
  ): Promise<Reminder> {
    const reminder = new this.reminderModel({
      userId,
      title,
      description,
      email,
      scheduledFor,
      status: 'pending',
    });

    return reminder.save();
  }

  async getUserReminders(userId: string): Promise<Reminder[]> {
    return this.reminderModel
      .find({ userId })
      .sort({ scheduledFor: 1 })
      .exec();
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const now = new Date();
    return this.reminderModel
      .find({
        status: 'pending',
        scheduledFor: { $lte: now },
      })
      .exec();
  }

  // Run every minute to check for due reminders
  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminderCron() {
    this.logger.log('Checking for due reminders...');
    
    const dueReminders = await this.getPendingReminders();
    
    if (dueReminders.length === 0) {
      return;
    }

    this.logger.log(`Found ${dueReminders.length} due reminders`);

    for (const reminder of dueReminders) {
      try {
        await this.sendReminderEmail(reminder);
        
        // Mark as sent
        reminder.status = 'sent';
        reminder.sent = true;
        reminder.sentAt = new Date();
        await reminder.save();
        
        this.logger.log(`Reminder sent successfully: ${reminder._id}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder ${reminder._id}:`, error);
        reminder.status = 'failed';
        await reminder.save();
      }
    }
  }

  private async sendReminderEmail(reminder: Reminder): Promise<void> {
    const subject = `Reminder: ${reminder.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .reminder-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #667eea; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 TarpAI Reminder</h1>
            </div>
            <div class="content">
              <div class="reminder-box">
                <h2>${reminder.title}</h2>
                ${reminder.description ? `<p>${reminder.description}</p>` : ''}
                <p style="color: #666; font-size: 14px;">
                  <strong>Scheduled for:</strong> ${reminder.scheduledFor.toLocaleString()}
                </p>
              </div>
              <p>This is an automated reminder set up through your TarpAI assistant.</p>
            </div>
            <div class="footer">
              <p>Powered by TarpAI - Your AI Assistant</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendEmail(reminder.email, subject, html);
  }

  async deleteReminder(reminderId: string, userId: string): Promise<void> {
    await this.reminderModel.deleteOne({ _id: reminderId, userId }).exec();
  }
}

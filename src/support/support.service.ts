import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Feedback } from './feedback.schema';
import { HelpArticle } from './help-article.schema';
import { ReleaseNote } from './release-note.schema';
import { Lead } from './lead.schema';
import { User } from '../users/user.schema';
import { EmailService } from '../auth/email.service';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
    @InjectModel(HelpArticle.name) private helpArticleModel: Model<HelpArticle>,
    @InjectModel(ReleaseNote.name) private releaseNoteModel: Model<ReleaseNote>,
    @InjectModel(Lead.name) private leadModel: Model<Lead>,
    @InjectModel(User.name) private userModel: Model<User>,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  // Feedback methods
  async submitFeedback(
    rating: number,
    message: string,
    userId?: string,
    email?: string,
  ) {
    const feedback = new this.feedbackModel({
      user: userId ? new Types.ObjectId(userId) : undefined,
      email: email,
      rating,
      message,
      status: 'pending',
    });

    await feedback.save();

    // Send feedback email to admin addresses
    try {
      // Get admin emails from environment variables
      const adminEmailsEnv = this.configService.get<string>('ADMIN_EMAILS') || '';
      const adminEmails = adminEmailsEnv.split(',').map(e => e.trim()).filter(e => e);
      
      if (adminEmails.length === 0) {
        console.warn('No admin emails configured in ADMIN_EMAILS environment variable');
        return {
          message: 'Feedback submitted successfully',
          feedback: {
            id: feedback._id,
            rating: feedback.rating,
            message: feedback.message,
            createdAt: feedback.createdAt,
          },
        };
      }
      
      // Fetch user details if userId is provided
      let userName = 'Anonymous';
      let userEmail = email || 'Not provided';
      
      if (userId) {
        try {
          const user = await this.userModel.findById(userId);
          if (user) {
            userName = user.displayName || user.name || 'Unknown User';
            if (user.email) {
              userEmail = user.email;
            }
          }
        } catch (error) {
          console.error('Failed to fetch user details:', error);
        }
      }

      const feedbackDetails = `
        <strong>New Feedback Received</strong><br><br>
        <strong>Rating:</strong> ${rating}/5<br>
        <strong>Message:</strong> ${message}<br>
        <strong>User Name:</strong> ${userName}<br>
        <strong>User Email:</strong> ${userEmail}<br>
        <strong>Submitted at:</strong> ${new Date().toLocaleString()}<br>
      `;

      for (const adminEmail of adminEmails) {
        await this.emailService.sendFeedbackEmail(adminEmail, feedbackDetails);
      }
    } catch (error) {
      console.error('Failed to send feedback email:', error);
      // Don't throw error - feedback should still be saved even if email fails
    }

    return {
      message: 'Feedback submitted successfully',
      feedback: {
        id: feedback._id,
        rating: feedback.rating,
        message: feedback.message,
        createdAt: feedback.createdAt,
      },
    };
  }

  async submitLead(
    name: string,
    email: string,
    action?: string,
    pagePath?: string,
    targetUserId?: string,
    targetUsername?: string,
  ) {
    const lead = new this.leadModel({
      name,
      email,
      action,
      pagePath,
      targetUserId: targetUserId ? new Types.ObjectId(targetUserId) : undefined,
      targetUsername,
    });

    await lead.save();

    return {
      message: 'Lead captured successfully',
      lead: {
        id: lead._id,
        name: lead.name,
        email: lead.email,
        action: lead.action,
        pagePath: lead.pagePath,
        targetUsername: lead.targetUsername,
        createdAt: lead.createdAt,
      },
    };
  }

  async getAllFeedback() {
    const feedback = await this.feedbackModel
      .find()
      .populate('user', 'name email username')
      .sort({ createdAt: -1 })
      .exec();

    return feedback.map(item => ({
      id: item._id,
      rating: item.rating,
      message: item.message,
      status: item.status,
      user: item.user,
      email: item.email,
      createdAt: item.createdAt,
    }));
  }

  // Help Center methods
  async getHelpArticles() {
    const articles = await this.helpArticleModel
      .find({ isActive: true })
      .sort({ category: 1, order: 1 })
      .exec();

    // Group by category
    const groupedArticles = articles.reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = [];
      }
      acc[article.category].push({
        id: article._id,
        title: article.title,
        content: article.content,
      });
      return acc;
    }, {});

    return {
      categories: Object.keys(groupedArticles),
      articles: groupedArticles,
    };
  }

  async getHelpArticle(id: string) {
    const article = await this.helpArticleModel.findById(id);
    if (!article) {
      throw new NotFoundException('Help article not found');
    }

    return {
      id: article._id,
      title: article.title,
      content: article.content,
      category: article.category,
    };
  }

  async createHelpArticle(
    title: string,
    content: string,
    category: string,
    order: number = 0,
  ) {
    const article = new this.helpArticleModel({
      title,
      content,
      category,
      order,
      isActive: true,
    });

    await article.save();

    return {
      message: 'Help article created successfully',
      article: {
        id: article._id,
        title: article.title,
        content: article.content,
        category: article.category,
      },
    };
  }

  // Release Notes methods
  async getReleaseNotes() {
    const notes = await this.releaseNoteModel
      .find({ isActive: true })
      .sort({ releaseDate: -1 })
      .exec();

    return notes.map(note => ({
      id: note._id,
      version: note.version,
      title: note.title,
      features: note.features,
      bugFixes: note.bugFixes,
      improvements: note.improvements,
      releaseDate: note.releaseDate,
    }));
  }

  async getReleaseNote(id: string) {
    const note = await this.releaseNoteModel.findById(id);
    if (!note) {
      throw new NotFoundException('Release note not found');
    }

    return {
      id: note._id,
      version: note.version,
      title: note.title,
      features: note.features,
      bugFixes: note.bugFixes,
      improvements: note.improvements,
      releaseDate: note.releaseDate,
    };
  }

  async createReleaseNote(
    version: string,
    title: string,
    features: string[],
    bugFixes: string[] = [],
    improvements: string[] = [],
    releaseDate: Date,
  ) {
    const note = new this.releaseNoteModel({
      version,
      title,
      features,
      bugFixes,
      improvements,
      releaseDate,
      isActive: true,
    });

    await note.save();

    return {
      message: 'Release note created successfully',
      note: {
        id: note._id,
        version: note.version,
        title: note.title,
        features: note.features,
        bugFixes: note.bugFixes,
        improvements: note.improvements,
        releaseDate: note.releaseDate,
      },
    };
  }

  // Contact support
  async contactSupport(
    userId: string,
    subject: string,
    message: string,
  ) {
    // This could send an email or create a support ticket
    // For now, we'll create a feedback entry with high priority
    const feedback = new this.feedbackModel({
      user: new Types.ObjectId(userId),
      rating: 5, // Default rating for support requests
      message: `SUPPORT REQUEST - ${subject}: ${message}`,
      status: 'pending',
    });

    await feedback.save();

    return {
      message: 'Support request submitted successfully. Our team will get back to you within 24 hours.',
      ticketId: feedback._id,
    };
  }

  // Seed initial data
  async seedInitialData() {
    // Check if data already exists
    const existingArticles = await this.helpArticleModel.countDocuments();
    const existingReleases = await this.releaseNoteModel.countDocuments();

    if (existingArticles === 0) {
      // Seed help articles
      const helpArticles = [
        {
          title: 'How do I change my username?',
          content: 'Go to Profile Settings > Edit Profile > Change Username. Your username must be unique and can contain letters, numbers, and underscores.',
          category: 'Common Questions',
          order: 1,
        },
        {
          title: 'Can I add a custom domain?',
          content: 'Custom domains are available for premium users. Contact support to set up your custom domain.',
          category: 'Common Questions',
          order: 2,
        },
        {
          title: 'How to verify my account?',
          content: 'Account verification is automatic when you verify your email address during signup. Check your email for the verification link.',
          category: 'Common Questions',
          order: 3,
        },
        {
          title: 'Privacy settings guide',
          content: 'Learn how to control who can see your posts, follow you, and send you messages in the Privacy Settings section.',
          category: 'Privacy',
          order: 1,
        },
      ];

      await this.helpArticleModel.insertMany(helpArticles);
    }

    if (existingReleases === 0) {
      // Seed release notes
      const releaseNotes = [
        {
          version: 'v2.4.0',
          title: 'Major Update',
          features: [
            'Added "TarpUp" direct messaging',
            'New Masonry layout for Status',
            'Multi-image upload support',
          ],
          bugFixes: [],
          improvements: [],
          releaseDate: new Date(),
        },
        {
          version: 'v2.3.1',
          title: 'Bug Fixes & Improvements',
          features: [],
          bugFixes: ['Bug fixes in Chat'],
          improvements: ['Performance improvements', 'Dark mode refinements'],
          releaseDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      ];

      await this.releaseNoteModel.insertMany(releaseNotes);
    }

    return { message: 'Initial data seeded successfully' };
  }
}

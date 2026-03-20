import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProfileVisit } from './profile-visit.schema';
import { ImportantMessage } from './important-message.schema';
import { User } from '../users/user.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(ProfileVisit.name) private profileVisitModel: Model<ProfileVisit>,
    @InjectModel(ImportantMessage.name) private importantMessageModel: Model<ImportantMessage>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async trackProfileVisit(
    username: string,
    visitorId?: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
  ) {
    // Find the profile owner
    const profileOwner = await this.userModel.findOne({ username });
    if (!profileOwner) {
      return null;
    }

    // Check if this is a unique visit (same IP hasn't visited this profile in last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingVisit = await this.profileVisitModel.findOne({
      profileOwner: profileOwner._id,
      $or: [
        { visitor: visitorId ? new Types.ObjectId(visitorId) : null },
        { ipAddress: ipAddress }
      ],
      createdAt: { $gte: last24Hours }
    });

    const isUniqueVisit = !existingVisit;

    // Create the visit record
    const visit = new this.profileVisitModel({
      profileOwner: profileOwner._id,
      username,
      visitor: visitorId ? new Types.ObjectId(visitorId) : undefined,
      ipAddress,
      userAgent,
      referrer,
      platform: this.detectPlatform(userAgent),
      isUniqueVisit,
    });

    await visit.save();
    return visit;
  }

  private detectPlatform(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    }
    if (/Tablet/.test(userAgent)) {
      return 'tablet';
    }
    return 'web';
  }

  async trackImportantMessage(
    messageId: string,
    senderId: string,
    recipientId: string,
    content: string,
    urgencyKeywords: string[] = [],
    detectionMethod: string = 'ai_detected',
    emailSent: boolean = false,
    autoReplyGenerated: boolean = false
  ) {
    const importantMessage = new this.importantMessageModel({
      messageId: new Types.ObjectId(messageId),
      sender: new Types.ObjectId(senderId),
      recipient: new Types.ObjectId(recipientId),
      content,
      urgencyKeywords,
      detectionMethod,
      emailSent,
      autoReplyGenerated,
    });

    await importantMessage.save();
    return importantMessage;
  }

  async getImportantMessageAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total important messages
    const totalImportantMessages = await this.importantMessageModel.countDocuments();

    // Today's important messages
    const importantMessagesToday = await this.importantMessageModel.countDocuments({
      createdAt: { $gte: today }
    });

    // Yesterday's important messages
    const importantMessagesYesterday = await this.importantMessageModel.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });

    // Weekly and monthly important messages
    const importantMessagesThisWeek = await this.importantMessageModel.countDocuments({
      createdAt: { $gte: last7Days }
    });

    const importantMessagesThisMonth = await this.importantMessageModel.countDocuments({
      createdAt: { $gte: last30Days }
    });

    // Daily important messages for last 7 days
    const dailyImportantMessages = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const count = await this.importantMessageModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });

      const emailsSent = await this.importantMessageModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        emailSent: true
      });

      const autoRepliesGenerated = await this.importantMessageModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        autoReplyGenerated: true
      });

      dailyImportantMessages.push({
        date: dayStart.toISOString().split('T')[0],
        total: count,
        emailsSent,
        autoRepliesGenerated
      });
    }

    // Detection method distribution
    const detectionMethodStats = await this.importantMessageModel.aggregate([
      {
        $group: {
          _id: '$detectionMethod',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Most common urgency keywords
    const keywordStats = await this.importantMessageModel.aggregate([
      { $unwind: '$urgencyKeywords' },
      {
        $group: {
          _id: '$urgencyKeywords',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Email notification stats
    const emailStats = {
      total: await this.importantMessageModel.countDocuments({ emailSent: true }),
      today: await this.importantMessageModel.countDocuments({ 
        emailSent: true, 
        createdAt: { $gte: today } 
      }),
      thisWeek: await this.importantMessageModel.countDocuments({ 
        emailSent: true, 
        createdAt: { $gte: last7Days } 
      })
    };

    // Auto-reply stats
    const autoReplyStats = {
      total: await this.importantMessageModel.countDocuments({ autoReplyGenerated: true }),
      today: await this.importantMessageModel.countDocuments({ 
        autoReplyGenerated: true, 
        createdAt: { $gte: today } 
      }),
      thisWeek: await this.importantMessageModel.countDocuments({ 
        autoReplyGenerated: true, 
        createdAt: { $gte: last7Days } 
      })
    };

    // Recent important messages
    const recentImportantMessages = await this.importantMessageModel
      .find()
      .populate('sender', 'username displayName name')
      .populate('recipient', 'username displayName name')
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      totalImportantMessages,
      importantMessagesToday,
      importantMessagesYesterday,
      importantMessagesThisWeek,
      importantMessagesThisMonth,
      growthRate: importantMessagesYesterday > 0 ? 
        ((importantMessagesToday - importantMessagesYesterday) / importantMessagesYesterday * 100).toFixed(2) : 
        importantMessagesToday > 0 ? '100' : '0',
      dailyImportantMessages,
      detectionMethodStats,
      keywordStats,
      emailStats,
      autoReplyStats,
      recentImportantMessages: recentImportantMessages.map(msg => ({
        id: msg._id,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        sender: {
          username: (msg.sender as any).username,
          displayName: (msg.sender as any).displayName || (msg.sender as any).name
        },
        recipient: {
          username: (msg.recipient as any).username,
          displayName: (msg.recipient as any).displayName || (msg.recipient as any).name
        },
        urgencyKeywords: msg.urgencyKeywords,
        detectionMethod: msg.detectionMethod,
        emailSent: msg.emailSent,
        autoReplyGenerated: msg.autoReplyGenerated,
        createdAt: msg.createdAt
      }))
    };
  }

  async getProfileVisitAnalytics() {
    if (!this.profileVisitModel) {
      throw new Error('ProfileVisit model not available');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total profile visits
    const totalVisits = await this.profileVisitModel.countDocuments();
    const uniqueVisits = await this.profileVisitModel.countDocuments({ isUniqueVisit: true });

    // Today's visits
    const visitsToday = await this.profileVisitModel.countDocuments({
      createdAt: { $gte: today }
    });
    const uniqueVisitsToday = await this.profileVisitModel.countDocuments({
      createdAt: { $gte: today },
      isUniqueVisit: true
    });

    // Yesterday's visits
    const visitsYesterday = await this.profileVisitModel.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });

    // Daily visits for last 7 days
    const dailyVisits = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const totalCount = await this.profileVisitModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });
      const uniqueCount = await this.profileVisitModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        isUniqueVisit: true
      });

      dailyVisits.push({
        date: dayStart.toISOString().split('T')[0],
        total: totalCount,
        unique: uniqueCount
      });
    }

    // Most visited profiles
    const mostVisitedProfiles = await this.profileVisitModel.aggregate([
      {
        $group: {
          _id: '$profileOwner',
          totalVisits: { $sum: 1 },
          uniqueVisits: { $sum: { $cond: ['$isUniqueVisit', 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { totalVisits: -1 } },
      { $limit: 10 }
    ]);

    // Platform distribution
    const platformStats = await this.profileVisitModel.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const weeklyVisits = await this.profileVisitModel.countDocuments({
      createdAt: { $gte: last7Days }
    });

    return {
      totalVisits,
      uniqueVisits,
      visitsToday,
      uniqueVisitsToday,
      visitsYesterday,
      weeklyVisits,
      growthRate: visitsYesterday > 0 ? 
        ((visitsToday - visitsYesterday) / visitsYesterday * 100).toFixed(2) : 
        visitsToday > 0 ? '100' : '0',
      dailyVisits,
      mostVisitedProfiles: mostVisitedProfiles.map(item => ({
        user: {
          username: item.user.username,
          displayName: item.user.displayName || item.user.name
        },
        totalVisits: item.totalVisits,
        uniqueVisits: item.uniqueVisits
      })),
      platformStats
    };
  }
}
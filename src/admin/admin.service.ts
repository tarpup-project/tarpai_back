import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Message } from '../chat/message.schema';
import { Conversation } from '../chat/conversation.schema';
import { AIConversation } from '../ai/ai-conversation.schema';
import { Feedback } from '../support/feedback.schema';
import { Broadcast } from '../broadcasts/broadcast.schema';
import { Link } from '../users/link.schema';
import { Status } from '../status/status.schema';
import { Notification } from '../notifications/notification.schema';
import { ProfileVisit } from '../analytics/profile-visit.schema';
import { ImportantMessage } from '../analytics/important-message.schema';
import { Background } from '../appearance/background.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(AIConversation.name) private aiConversationModel: Model<AIConversation>,
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
    @InjectModel(Broadcast.name) private broadcastModel: Model<Broadcast>,
    @InjectModel(Link.name) private linkModel: Model<Link>,
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @InjectModel(ProfileVisit.name) private profileVisitModel: Model<ProfileVisit>,
    @InjectModel(ImportantMessage.name) private importantMessageModel: Model<ImportantMessage>,
    @InjectModel(Background.name) private backgroundModel: Model<Background>,
  ) {}

  // 1. User Analytics
  async getUserAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total users
    const totalUsers = await this.userModel.countDocuments();

    // New signups today
    const newSignupsToday = await this.userModel.countDocuments({
      createdAt: { $gte: today }
    });

    // New signups yesterday
    const newSignupsYesterday = await this.userModel.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });

    // Daily signups for last 7 days
    const dailySignups = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.userModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });
      dailySignups.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    // Weekly and monthly signups
    const weeklySignups = await this.userModel.countDocuments({
      createdAt: { $gte: last7Days }
    });

    const monthlySignups = await this.userModel.countDocuments({
      createdAt: { $gte: last30Days }
    });

    return {
      totalUsers,
      newSignupsToday,
      newSignupsYesterday,
      weeklySignups,
      monthlySignups,
      dailySignups,
      growthRate: newSignupsYesterday > 0 ? 
        ((newSignupsToday - newSignupsYesterday) / newSignupsYesterday * 100).toFixed(2) : 
        newSignupsToday > 0 ? '100' : '0'
    };
  }

  // 2. First Time Messages Analytics
  async getFirstTimeMessagesAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get conversations where hasRepliedToInitialMessage is false (first message sent but no reply yet)
    const firstTimeMessagesToday = await this.conversationModel.countDocuments({
      createdAt: { $gte: today },
      hasRepliedToInitialMessage: false
    });

    const firstTimeMessagesYesterday = await this.conversationModel.countDocuments({
      createdAt: { $gte: yesterday, $lt: today },
      hasRepliedToInitialMessage: false
    });

    // Daily first time messages for last 7 days
    const dailyFirstTimeMessages = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.conversationModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        hasRepliedToInitialMessage: false
      });
      dailyFirstTimeMessages.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    const weeklyFirstTimeMessages = await this.conversationModel.countDocuments({
      createdAt: { $gte: last7Days },
      hasRepliedToInitialMessage: false
    });

    const totalFirstTimeMessages = await this.conversationModel.countDocuments({
      hasRepliedToInitialMessage: false
    });

    return {
      totalFirstTimeMessages,
      firstTimeMessagesToday,
      firstTimeMessagesYesterday,
      weeklyFirstTimeMessages,
      dailyFirstTimeMessages
    };
  }

  // 3. AI Messages Analytics
  async getAIMessagesAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count AI messages from regular chat (isAI: true)
    const aiMessagesToday = await this.messageModel.countDocuments({
      isAI: true,
      createdAt: { $gte: today }
    });

    const aiMessagesYesterday = await this.messageModel.countDocuments({
      isAI: true,
      createdAt: { $gte: yesterday, $lt: today }
    });

    // Count AI conversations and messages from AI chat service
    const aiConversationsToday = await this.aiConversationModel.countDocuments({
      createdAt: { $gte: today }
    });

    // Count total AI messages from AI conversations
    const aiConversations = await this.aiConversationModel.find({
      createdAt: { $gte: today }
    });

    let aiChatMessagesToday = 0;
    aiConversations.forEach(conv => {
      aiChatMessagesToday += conv.messages.filter(msg => 
        msg.role === 'assistant' && 
        new Date(msg.timestamp) >= today
      ).length;
    });

    // Daily AI messages for last 7 days
    const dailyAIMessages = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const regularAI = await this.messageModel.countDocuments({
        isAI: true,
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });

      const aiConvs = await this.aiConversationModel.find({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });

      let aiChatCount = 0;
      aiConvs.forEach(conv => {
        aiChatCount += conv.messages.filter(msg => 
          msg.role === 'assistant' && 
          new Date(msg.timestamp) >= dayStart && 
          new Date(msg.timestamp) < dayEnd
        ).length;
      });

      dailyAIMessages.push({
        date: dayStart.toISOString().split('T')[0],
        regularAI,
        aiChat: aiChatCount,
        total: regularAI + aiChatCount
      });
    }

    const totalAIMessages = await this.messageModel.countDocuments({ isAI: true });
    const totalAIConversations = await this.aiConversationModel.countDocuments();

    return {
      totalAIMessages,
      totalAIConversations,
      aiMessagesToday: aiMessagesToday + aiChatMessagesToday,
      aiMessagesYesterday,
      aiConversationsToday,
      dailyAIMessages
    };
  }

  // 4. Feedback Analytics
  async getFeedbackAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all feedback
    const allFeedback = await this.feedbackModel
      .find()
      .populate('user', 'name email username displayName')
      .sort({ createdAt: -1 })
      .limit(100);

    // Feedback counts
    const totalFeedback = await this.feedbackModel.countDocuments();
    const feedbackToday = await this.feedbackModel.countDocuments({
      createdAt: { $gte: today }
    });
    const feedbackThisWeek = await this.feedbackModel.countDocuments({
      createdAt: { $gte: last7Days }
    });
    const feedbackThisMonth = await this.feedbackModel.countDocuments({
      createdAt: { $gte: last30Days }
    });

    // Rating distribution
    const ratingDistribution = await this.feedbackModel.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Average rating
    const avgRatingResult = await this.feedbackModel.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    const averageRating = avgRatingResult[0]?.avgRating || 0;

    // Status distribution
    const statusDistribution = await this.feedbackModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      totalFeedback,
      feedbackToday,
      feedbackThisWeek,
      feedbackThisMonth,
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingDistribution,
      statusDistribution,
      recentFeedback: allFeedback.map(feedback => ({
        id: feedback._id,
        rating: feedback.rating,
        message: feedback.message,
        status: feedback.status,
        user: feedback.user ? {
          name: (feedback.user as any).displayName || (feedback.user as any).name,
          email: (feedback.user as any).email,
          username: (feedback.user as any).username
        } : null,
        email: feedback.email,
        createdAt: feedback.createdAt
      }))
    };
  }

  // 5. Broadcast Analytics
  async getBroadcastAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const broadcastsToday = await this.broadcastModel.countDocuments({
      createdAt: { $gte: today }
    });

    const broadcastsYesterday = await this.broadcastModel.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });

    // Daily broadcasts for last 7 days
    const dailyBroadcasts = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.broadcastModel.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });
      const recipientSum = await this.broadcastModel.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, totalRecipients: { $sum: '$recipientCount' } } }
      ]);
      
      dailyBroadcasts.push({
        date: dayStart.toISOString().split('T')[0],
        broadcasts: count,
        recipients: recipientSum[0]?.totalRecipients || 0
      });
    }

    const totalBroadcasts = await this.broadcastModel.countDocuments();
    const weeklyBroadcasts = await this.broadcastModel.countDocuments({
      createdAt: { $gte: last7Days }
    });

    // Total recipients reached
    const totalRecipientsResult = await this.broadcastModel.aggregate([
      { $group: { _id: null, totalRecipients: { $sum: '$recipientCount' } } }
    ]);
    const totalRecipients = totalRecipientsResult[0]?.totalRecipients || 0;

    // Recent broadcasts
    const recentBroadcasts = await this.broadcastModel
      .find()
      .populate('sender', 'name displayName username')
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      totalBroadcasts,
      broadcastsToday,
      broadcastsYesterday,
      weeklyBroadcasts,
      totalRecipients,
      dailyBroadcasts,
      recentBroadcasts: recentBroadcasts.map(broadcast => ({
        id: broadcast._id,
        message: broadcast.message,
        recipientCount: broadcast.recipientCount,
        sender: broadcast.sender ? {
          name: (broadcast.sender as any).displayName || (broadcast.sender as any).name || 'Unknown User',
          username: (broadcast.sender as any).username || 'unknown'
        } : {
          name: 'Unknown User',
          username: 'unknown'
        },
        createdAt: broadcast.createdAt
      }))
    };
  }

  // 6. Important Message Analytics
  async getImportantMessageAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

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

      dailyImportantMessages.push({
        date: dayStart.toISOString().split('T')[0],
        total: count,
        emailsSent
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

    const weeklyImportantMessages = await this.importantMessageModel.countDocuments({
      createdAt: { $gte: last7Days }
    });

    const emailNotificationsSent = await this.importantMessageModel.countDocuments({
      emailSent: true
    });

    return {
      totalImportantMessages,
      importantMessagesToday,
      importantMessagesYesterday,
      weeklyImportantMessages,
      emailNotificationsSent,
      growthRate: importantMessagesYesterday > 0 ? 
        ((importantMessagesToday - importantMessagesYesterday) / importantMessagesYesterday * 100).toFixed(2) : 
        importantMessagesToday > 0 ? '100' : '0',
      dailyImportantMessages,
      detectionMethodStats,
      keywordStats: keywordStats.map(item => ({
        keyword: item._id,
        count: item.count
      }))
    };
  }

  // 7. Profile Visit Analytics (Link Clicks)
  async getProfileVisitAnalytics() {
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

  // Dashboard Overview
  async getDashboardOverview() {
    try {
      const [
        userAnalytics,
        firstTimeMessages,
        aiMessages,
        feedback,
        broadcasts,
        importantMessages,
        profileVisits
      ] = await Promise.all([
        this.getUserAnalytics().catch(err => {
          console.error('Error loading user analytics:', err);
          return { totalUsers: 0, newSignupsToday: 0, growthRate: '0' };
        }),
        this.getFirstTimeMessagesAnalytics().catch(err => {
          console.error('Error loading first time messages:', err);
          return { firstTimeMessagesToday: 0 };
        }),
        this.getAIMessagesAnalytics().catch(err => {
          console.error('Error loading AI messages:', err);
          return { aiMessagesToday: 0 };
        }),
        this.getFeedbackAnalytics().catch(err => {
          console.error('Error loading feedback:', err);
          return { totalFeedback: 0, averageRating: 0, feedbackToday: 0 };
        }),
        this.getBroadcastAnalytics().catch(err => {
          console.error('Error loading broadcasts:', err);
          return { totalBroadcasts: 0, broadcastsToday: 0, totalRecipients: 0 };
        }),
        this.getImportantMessageAnalytics().catch(err => {
          console.error('Error loading important messages:', err);
          return { importantMessagesToday: 0 };
        }),
        this.getProfileVisitAnalytics().catch(err => {
          console.error('Error loading profile visits:', err);
          return { totalVisits: 0, uniqueVisits: 0, visitsToday: 0 };
        })
      ]);

      return {
        users: {
          total: userAnalytics.totalUsers,
          newToday: userAnalytics.newSignupsToday,
          growthRate: userAnalytics.growthRate
        },
        messages: {
          firstTimeToday: firstTimeMessages.firstTimeMessagesToday,
          aiMessagesToday: aiMessages.aiMessagesToday,
          importantToday: importantMessages.importantMessagesToday
        },
        feedback: {
          total: feedback.totalFeedback,
          averageRating: feedback.averageRating,
          newToday: feedback.feedbackToday
        },
        broadcasts: {
          total: broadcasts.totalBroadcasts,
          sentToday: broadcasts.broadcastsToday,
          totalRecipients: broadcasts.totalRecipients
        },
        profileVisits: {
          total: profileVisits.totalVisits,
          unique: profileVisits.uniqueVisits,
          visitsToday: profileVisits.visitsToday
        }
      };
    } catch (error) {
      console.error('Error in getDashboardOverview:', error);
      // Return default values if everything fails
      return {
        users: { total: 0, newToday: 0, growthRate: '0' },
        messages: { firstTimeToday: 0, aiMessagesToday: 0, importantToday: 0 },
        feedback: { total: 0, averageRating: 0, newToday: 0 },
        broadcasts: { total: 0, sentToday: 0, totalRecipients: 0 },
        profileVisits: { total: 0, unique: 0, visitsToday: 0 }
      };
    }
  }

  // Get all users for admin broadcast
  async getAllUsers() {
    const users = await this.userModel
      .find({ isVerified: true })
      .select('_id name displayName username email avatar yearlyBroadcastCount broadcastPeriodStart followers following createdAt')
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to prevent performance issues

    console.log(`📊 Admin getAllUsers: Found ${users.length} users`);
    
    // Debug: Log first user's followers/following
    if (users.length > 0) {
      const firstUser = users[0];
      console.log(`🔍 First user (${firstUser.name}):`, {
        followers: firstUser.followers,
        followersLength: firstUser.followers?.length,
        following: firstUser.following,
        followingLength: firstUser.following?.length,
      });
    }

    // Get actual broadcast counts from the database
    const userIds = users.map(user => user._id);
    const broadcastCounts = await this.broadcastModel.aggregate([
      { $match: { sender: { $in: userIds } } },
      { $group: { _id: '$sender', count: { $sum: 1 } } }
    ]);

    const broadcastCountMap = new Map();
    broadcastCounts.forEach(bc => {
      broadcastCountMap.set(bc._id.toString(), bc.count);
    });

    return users.map(user => {
      // Ensure followers and following are arrays and get their lengths
      const followersArray = Array.isArray(user.followers) ? user.followers : [];
      const followingArray = Array.isArray(user.following) ? user.following : [];
      
      return {
        id: user._id,
        name: user.name,
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        yearlyBroadcastCount: user.yearlyBroadcastCount || 0,
        actualBroadcastCount: broadcastCountMap.get(user._id.toString()) || 0,
        broadcastPeriodStart: user.broadcastPeriodStart,
        followersCount: followersArray.length,
        followingCount: followingArray.length,
        createdAt: user.createdAt,
      };
    });
  }

  // Get recent signups for the past 10 days
  async getRecentSignups() {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const recentUsers = await this.userModel
      .find({ 
        createdAt: { $gte: tenDaysAgo },
        isVerified: true 
      })
      .select('_id name displayName username email avatar createdAt')
      .sort({ createdAt: -1 })
      .limit(100);

    // Group by day
    const dailySignups = [];
    for (let i = 0; i < 10; i++) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayUsers = recentUsers.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate >= dayStart && userDate < dayEnd;
      });

      dailySignups.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayUsers.length,
        users: dayUsers.map(user => ({
          id: user._id,
          name: user.name,
          displayName: user.displayName,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
        }))
      });
    }

    return {
      totalRecentSignups: recentUsers.length,
      dailySignups,
      recentUsers: recentUsers.slice(0, 20).map(user => ({
        id: user._id,
        name: user.name,
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      }))
    };
  }

  async resetUserBroadcastPrivileges(userId: string) {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Reset broadcast count and period start
    user.yearlyBroadcastCount = 0;
    user.broadcastPeriodStart = null;
    await user.save();

    return {
      message: `Broadcast privileges reset for ${user.displayName || user.name}`,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        yearlyBroadcastCount: user.yearlyBroadcastCount,
        broadcastPeriodStart: user.broadcastPeriodStart,
      }
    };
  }

  async deleteUserCompletely(userId: string) {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deletion of admin user
    const adminEmail = 'travorproject@gmail.com';
    if (user.email === adminEmail) {
      throw new Error('Cannot delete admin user');
    }

    console.log(`🗑️  Starting complete deletion for user: ${user.name} (@${user.username}) - ${user.email}`);

    try {
      let deletedCounts = {
        conversations: 0,
        messages: 0,
        statuses: 0,
        notifications: 0,
        broadcasts: 0,
        links: 0,
        followRelationships: 0,
        profileVisits: 0,
        importantMessages: 0,
      };

      // 1. Delete user's conversations and related messages
      const conversations = await this.conversationModel.find({
        participants: userId
      });

      for (const conversation of conversations) {
        const messageDeleteResult = await this.messageModel.deleteMany({
          conversation: conversation._id
        });
        deletedCounts.messages += messageDeleteResult.deletedCount;
      }

      const conversationDeleteResult = await this.conversationModel.deleteMany({
        participants: userId
      });
      deletedCounts.conversations = conversationDeleteResult.deletedCount;

      // Delete any remaining messages from this user
      const userMessageDeleteResult = await this.messageModel.deleteMany({
        sender: userId
      });
      deletedCounts.messages += userMessageDeleteResult.deletedCount;

      // 2. Delete user's statuses
      const statusDeleteResult = await this.statusModel.deleteMany({
        user: userId
      });
      deletedCounts.statuses = statusDeleteResult.deletedCount;

      // 3. Delete notifications for/from this user
      const notificationDeleteResult = await this.notificationModel.deleteMany({
        $or: [
          { recipient: userId },
          { sender: userId }
        ]
      });
      deletedCounts.notifications = notificationDeleteResult.deletedCount;

      // 4. Delete user's broadcasts
      const broadcastDeleteResult = await this.broadcastModel.deleteMany({
        sender: userId
      });
      deletedCounts.broadcasts = broadcastDeleteResult.deletedCount;

      // 5. Delete user's links
      const linkDeleteResult = await this.linkModel.deleteMany({
        user: userId
      });
      deletedCounts.links = linkDeleteResult.deletedCount;

      // 6. Delete profile visits for/by this user
      const profileVisitDeleteResult = await this.profileVisitModel.deleteMany({
        $or: [
          { visitor: userId },
          { profileOwner: userId }
        ]
      });
      deletedCounts.profileVisits = profileVisitDeleteResult.deletedCount;

      // 7. Delete important messages from this user
      const importantMessageDeleteResult = await this.importantMessageModel.deleteMany({
        sender: userId
      });
      deletedCounts.importantMessages = importantMessageDeleteResult.deletedCount;

      // 8. Remove user from other users' followers/following lists
      const followersUpdateResult = await this.userModel.updateMany(
        { followers: userId },
        { $pull: { followers: userId } }
      );

      const followingUpdateResult = await this.userModel.updateMany(
        { following: userId },
        { $pull: { following: userId } }
      );

      deletedCounts.followRelationships = followersUpdateResult.modifiedCount + followingUpdateResult.modifiedCount;

      // 9. Finally, delete the user
      await this.userModel.findByIdAndDelete(userId);

      console.log(`✅ Successfully deleted user: ${user.name} (@${user.username})`);
      console.log(`📊 Cleanup summary:`, deletedCounts);

      return {
        message: `User ${user.displayName || user.name} (@${user.username}) and all associated data deleted successfully`,
        deletedUser: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
        },
        cleanupSummary: deletedCounts,
      };

    } catch (error) {
      console.error(`❌ Error during user deletion:`, error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // Appearance Management Methods
  async getAllBackgrounds() {
    const backgrounds = await this.backgroundModel
      .find()
      .populate('userId', 'name displayName username email')
      .sort({ createdAt: -1 });

    return backgrounds.map(bg => ({
      id: bg._id,
      url: bg.url,
      thumbnail: bg.thumbnail,
      name: bg.name,
      type: bg.type,
      isActive: bg.isActive,
      createdAt: bg.createdAt,
      user: bg.userId ? {
        id: (bg.userId as any)._id,
        name: (bg.userId as any).displayName || (bg.userId as any).name,
        username: (bg.userId as any).username,
        email: (bg.userId as any).email,
      } : null
    }));
  }

  async createAdminBackground(url: string, name?: string, thumbnail?: string) {
    const background = new this.backgroundModel({
      url,
      name: name || 'Admin Background',
      thumbnail: thumbnail || url,
      isActive: true,
      type: 'admin',
    });

    await background.save();

    return {
      message: 'Admin background created successfully',
      background: {
        id: background._id,
        url: background.url,
        thumbnail: background.thumbnail,
        name: background.name,
        type: background.type,
        isActive: background.isActive,
        createdAt: background.createdAt,
      },
    };
  }

  async updateBackground(id: string, data: { url?: string; name?: string; thumbnail?: string; isActive?: boolean }) {
    const background = await this.backgroundModel.findById(id);
    
    if (!background) {
      throw new Error('Background not found');
    }

    const updated = await this.backgroundModel.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );

    return {
      message: 'Background updated successfully',
      background: {
        id: updated._id,
        url: updated.url,
        thumbnail: updated.thumbnail,
        name: updated.name,
        type: updated.type,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      },
    };
  }

  async deleteBackground(id: string) {
    const background = await this.backgroundModel.findById(id);
    
    if (!background) {
      throw new Error('Background not found');
    }

    await this.backgroundModel.findByIdAndDelete(id);

    return {
      message: `Background "${background.name}" deleted successfully`,
      deletedBackground: {
        id: background._id,
        name: background.name,
        type: background.type,
      }
    };
  }

  async getBackgroundStats() {
    const totalBackgrounds = await this.backgroundModel.countDocuments();
    const adminBackgrounds = await this.backgroundModel.countDocuments({ type: 'admin' });
    const userBackgrounds = await this.backgroundModel.countDocuments({ type: 'user' });
    const activeBackgrounds = await this.backgroundModel.countDocuments({ isActive: true });
    const inactiveBackgrounds = await this.backgroundModel.countDocuments({ isActive: false });

    return {
      totalBackgrounds,
      adminBackgrounds,
      userBackgrounds,
      activeBackgrounds,
      inactiveBackgrounds,
    };
  }

  async uploadAdminBackground(file: Express.Multer.File, name?: string) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const cloudinary = require('cloudinary').v2;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'tarpai/admin-backgrounds',
          public_id: `admin_bg_${Date.now()}`,
        },
        async (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }

          // Save to database
          const background = new this.backgroundModel({
            url: result.secure_url,
            name: name || 'Admin Background',
            thumbnail: result.secure_url,
            isActive: true,
            type: 'admin',
          });

          await background.save();

          resolve({
            message: 'Admin background uploaded successfully',
            background: {
              id: background._id,
              url: background.url,
              thumbnail: background.thumbnail,
              name: background.name,
              type: background.type,
              isActive: background.isActive,
              createdAt: background.createdAt,
            },
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }
}
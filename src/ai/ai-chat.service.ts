import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import OpenAI from 'openai';
import { AIConversation, AIMessage } from './ai-conversation.schema';
import { User } from '../users/user.schema';
import { ReminderService } from './reminder.service';

@Injectable()
export class AIChatService {
  private openai: OpenAI | null = null;

  constructor(
    @InjectModel(AIConversation.name) private aiConversationModel: Model<AIConversation>,
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
    private reminderService: ReminderService,
  ) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    
    if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://tarpai.onrender.com',
          'X-Title': 'TarpAI Assistant',
        },
      });
      console.log('OpenRouter AI initialized for chat service');
    } else {
      console.log('OpenRouter API key not configured for chat');
    }
  }

  async getOrCreateConversation(userId: string): Promise<AIConversation> {
    let conversation = await this.aiConversationModel.findOne({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });

    if (!conversation) {
      const user = await this.userModel.findById(userId);
      const userName = user?.displayName || user?.name || 'there';

      conversation = new this.aiConversationModel({
        userId: new Types.ObjectId(userId),
        messages: [
          {
            role: 'system',
            content: `You are TarpAI, a helpful AI assistant integrated into the TarpAI social platform. You help users with:
- Creating reminders and scheduling meetings
- Managing appointments and schedules
- Setting up email notifications for important events
- General questions and assistance
- Social platform features

The user's name is ${userName}. Be friendly, helpful, and concise. Keep responses under 200 words unless more detail is specifically requested.

When creating reminders:
1. Ask for the user's email if you don't have it
2. Get clear details about what they want to be reminded about
3. Confirm the date and time
4. Use the create_reminder function to set it up

Current date and time: ${new Date().toISOString()}`,
            timestamp: new Date(),
          },
          {
            role: 'assistant',
            content: `Hello ${userName}! I'm TarpAI, your AI assistant. I can help you set up reminders, schedule meetings, and manage your time. Just let me know what you need!`,
            timestamp: new Date(),
          },
        ],
        isActive: true,
        lastMessageAt: new Date(),
      });

      await conversation.save();
    }

    return conversation;
  }

  async sendMessage(userId: string, message: string): Promise<{ response: string; conversationId: string }> {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (!this.openai) {
      throw new BadRequestException('AI service is not configured');
    }

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(userId);

    // Add user message to conversation
    const userMessage: AIMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    conversation.messages.push(userMessage);

    try {
      // Prepare messages for OpenRouter
      const messagesToSend = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Define function tools for the AI
      const tools = [
        {
          type: 'function',
          function: {
            name: 'create_reminder',
            description: 'Create a reminder or meeting notification that will be sent via email at the specified time. Use this when the user wants to schedule a reminder, meeting, or event.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Short title for the reminder (e.g., "Team Meeting", "Doctor Appointment")',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the reminder or meeting',
                },
                email: {
                  type: 'string',
                  description: 'Email address where the reminder should be sent',
                },
                scheduledFor: {
                  type: 'string',
                  description: 'ISO 8601 date-time string for when the reminder should be sent (e.g., "2026-03-01T14:00:00Z")',
                },
              },
              required: ['title', 'email', 'scheduledFor'],
            },
          },
        },
      ];

      // Call OpenRouter API with function calling
      const completion = await this.openai.chat.completions.create({
        model: 'openai/gpt-3.5-turbo',
        messages: messagesToSend as any,
        tools: tools as any,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseMessage = completion.choices[0]?.message;

      // Check if AI wants to call a function
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0] as any;
        
        if (toolCall.function?.name === 'create_reminder') {
          const args = JSON.parse(toolCall.function.arguments);
          
          // Create the reminder
          const reminder = await this.reminderService.createReminder(
            userId,
            args.title,
            args.description || '',
            args.email,
            new Date(args.scheduledFor),
          );

          // Create a response about the reminder
          const confirmationMessage = `✅ Perfect! I've scheduled your reminder "${args.title}" for ${new Date(args.scheduledFor).toLocaleString()}. You'll receive an email at ${args.email} when it's time.`;

          // Add AI response to conversation
          const assistantMessage: AIMessage = {
            role: 'assistant',
            content: confirmationMessage,
            timestamp: new Date(),
          };

          conversation.messages.push(assistantMessage);
          conversation.lastMessageAt = new Date();
          await conversation.save();

          return {
            response: confirmationMessage,
            conversationId: conversation._id.toString(),
          };
        }
      }

      // Regular text response (no function call)
      const aiResponse = responseMessage?.content || 'I apologize, but I could not generate a response. Please try again.';

      // Add AI response to conversation
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      conversation.messages.push(assistantMessage);
      conversation.lastMessageAt = new Date();

      // Keep only last 50 messages to prevent conversation from growing too large
      if (conversation.messages.length > 50) {
        // Keep system message and last 49 messages
        const systemMessage = conversation.messages[0];
        const recentMessages = conversation.messages.slice(-49);
        conversation.messages = [systemMessage, ...recentMessages];
      }

      await conversation.save();

      return {
        response: aiResponse,
        conversationId: conversation._id.toString(),
      };
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw new BadRequestException('Failed to get AI response. Please try again.');
    }
  }

  async getConversationHistory(userId: string): Promise<AIMessage[]> {
    const conversation = await this.getOrCreateConversation(userId);
    
    // Return all messages except the system message
    return conversation.messages.filter(msg => msg.role !== 'system');
  }

  async clearConversation(userId: string): Promise<void> {
    const conversation = await this.aiConversationModel.findOne({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });

    if (conversation) {
      conversation.isActive = false;
      await conversation.save();
    }
  }
}

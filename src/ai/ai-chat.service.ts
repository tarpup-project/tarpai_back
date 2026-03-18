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
      const userEmail = user?.email || 'not provided';

      conversation = new this.aiConversationModel({
        userId: new Types.ObjectId(userId),
        messages: [
          {
            role: 'system',
            content: `You are TarpAI, a specialized AI assistant integrated into the TarpAI social platform. You ONLY help users with these specific tasks:

ALLOWED TASKS:
- Creating reminders and email notifications for important events
- Answering questions about the TarpAI platform features and functionality
- Helping users find other users by searching for usernames or display names
- Basic troubleshooting of platform issues
- Account-related questions and guidance
- Explaining how TarpAI features work (messaging, profiles, status updates, etc.)

STRICTLY FORBIDDEN - You MUST refuse these requests:
- Writing code, scripts, or programming solutions
- Complex technical explanations or tutorials
- Creative writing, stories, or content creation
- Academic help, homework, or research assistance
- General knowledge questions unrelated to TarpAI platform
- Mathematical calculations or problem solving
- Calendar management or scheduling (this feature has been removed)
- Any request that doesn't relate to reminders, platform support, or user search

User Information:
- Name: ${userName}
- Email: ${userEmail}

RESPONSE GUIDELINES:
- Be friendly and helpful while staying focused on your allowed tasks
- Keep responses under 200 words
- If asked to do something outside your scope, politely decline and redirect to your core functions
- For forbidden requests, respond: "I'm specialized in helping with reminders, TarpAI platform questions, and finding users. I can't assist with [their request]. Is there anything I can help you with regarding the platform or would you like me to set up a reminder?"

IMPORTANT: When creating reminders, use the user's email address: ${userEmail}

When creating reminders:
1. Get reminder details (title, description, date/time)
2. Format time as "YYYY-MM-DDTHH:mm:00Z" (UTC format)
3. Call create_reminder function with the user's email
4. Confirm the reminder has been set

When helping users find other users:
1. Ask for the name or username they're looking for
2. Use the search_users function to find matching users
3. Present the results in a friendly, organized way
4. Help them understand how to connect with found users

Current date: ${new Date().toLocaleDateString()}
Current time: ${new Date().toLocaleTimeString()}`,
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

  async sendMessage(userId: string, message: string): Promise<{ response: string; conversationId: string; action?: string }> {
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
            description: 'Create a reminder or meeting notification that will be sent via email at the specified time. Use this when the user wants to schedule a reminder or set up a notification.',
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
        {
          type: 'function',
          function: {
            name: 'search_users',
            description: 'Search for users in the TarpAI platform by name, display name, or username. Use this when the user wants to find other users on the platform.',
            parameters: {
              type: 'object',
              properties: {
                searchQuery: {
                  type: 'string',
                  description: 'The name, display name, or username to search for',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                },
              },
              required: ['searchQuery'],
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
          await this.reminderService.createReminder(
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

        if (toolCall.function?.name === 'search_users') {
          const args = JSON.parse(toolCall.function.arguments);
          
          try {
            // Search for users by name, display name, or username
            const searchQuery = args.searchQuery;
            const limit = args.limit || 10;
            
            const users = await this.userModel.find({
              $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { displayName: { $regex: searchQuery, $options: 'i' } },
                { username: { $regex: searchQuery, $options: 'i' } },
              ],
            })
            .select('name displayName username avatar')
            .limit(limit)
            .exec();

            if (users.length === 0) {
              const message = `I couldn't find any users matching "${searchQuery}". Try searching with a different name or username.`;
              
              const assistantMessage: AIMessage = {
                role: 'assistant',
                content: message,
                timestamp: new Date(),
              };

              conversation.messages.push(assistantMessage);
              conversation.lastMessageAt = new Date();
              await conversation.save();

              return {
                response: message,
                conversationId: conversation._id.toString(),
              };
            }

            // Format users list for display
            let usersList = `Found ${users.length} user${users.length > 1 ? 's' : ''} matching "${searchQuery}":\n\n`;
            
            users.forEach((user, index) => {
              usersList += `${index + 1}. **${user.displayName || user.name}**\n`;
              usersList += `   Username: @${user.username}\n`;
              usersList += `   You can find them at: tarpup.ai/${user.username}\n\n`;
            });

            usersList += `💡 Tip: You can visit their profile or send them a message by going to their profile page!`;

            const assistantMessage: AIMessage = {
              role: 'assistant',
              content: usersList,
              timestamp: new Date(),
            };

            conversation.messages.push(assistantMessage);
            conversation.lastMessageAt = new Date();
            await conversation.save();

            return {
              response: usersList,
              conversationId: conversation._id.toString(),
            };
          } catch (error) {
            const errorMessage = "I encountered an error while searching for users. Please try again.";

            const assistantMessage: AIMessage = {
              role: 'assistant',
              content: errorMessage,
              timestamp: new Date(),
            };

            conversation.messages.push(assistantMessage);
            conversation.lastMessageAt = new Date();
            await conversation.save();

            return {
              response: errorMessage,
              conversationId: conversation._id.toString(),
            };
          }
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
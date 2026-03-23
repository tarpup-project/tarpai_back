import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import OpenAI from 'openai';
import { AIConversation, AIMessage } from './ai-conversation.schema';
import { User } from '../users/user.schema';

@Injectable()
export class AIChatService {
  private openai: OpenAI | null = null;

  constructor(
    @InjectModel(AIConversation.name) private aiConversationModel: Model<AIConversation>,
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    
    if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://tarpup.ai',
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
            content: `You are TarpAI, a messaging assistant that helps users communicate with people across platforms. You're integrated into the TarpAI social platform to facilitate better connections and communication.

WHAT YOU CAN HELP WITH:
- Helping users find and connect with other people on TarpAI
- Answering questions about messaging features and communication tools
- Explaining how to use TarpAI's social features (profiles, status updates, messaging, etc.)
- Providing guidance on cross-platform communication and networking
- Basic troubleshooting of messaging and platform issues
- Account-related questions and communication settings

WHAT YOU CANNOT DO:
- Writing code, scripts, or programming solutions
- Complex technical explanations or tutorials
- Creative writing, stories, or content creation
- Academic help, homework, or research assistance
- General knowledge questions unrelated to communication or TarpAI
- Mathematical calculations or problem solving
- Calendar management, scheduling, or reminder services
- Any request that doesn't relate to messaging, communication, or the TarpAI platform

User Information:
- Name: ${userName}
- Email: ${userEmail}

RESPONSE GUIDELINES:
- Be friendly and helpful while focusing on communication and messaging support
- Keep responses under 200 words and conversational
- Emphasize your role as a messaging assistant that bridges communication across platforms
- If asked to do something outside your scope, politely decline and redirect: "I'm a messaging assistant that helps you communicate with people across platforms. I can't assist with [their request]. Is there anything I can help you with regarding messaging, finding users, or using TarpAI's communication features?"

When helping users find other users:
1. Ask for the name or username they're looking for
2. Use the search_users function to find matching users
3. Present the results in a friendly, organized way
4. Help them understand how to connect and start conversations with found users

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
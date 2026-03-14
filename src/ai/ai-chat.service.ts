import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import OpenAI from 'openai';
import { AIConversation, AIMessage } from './ai-conversation.schema';
import { User } from '../users/user.schema';
import { ReminderService } from './reminder.service';
import { CalendarService } from './calendar.service';

@Injectable()
export class AIChatService {
  private openai: OpenAI | null = null;

  constructor(
    @InjectModel(AIConversation.name) private aiConversationModel: Model<AIConversation>,
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
    private reminderService: ReminderService,
    private calendarService: CalendarService,
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
- Creating events in their Google Calendar
- Listing and deleting events from their Google Calendar
- Creating reminders and scheduling meetings
- Managing appointments and schedules
- Setting up email notifications for important events
- Basic questions about the TarpAI platform features
- Simple troubleshooting of platform issues
- Account-related questions

STRICTLY FORBIDDEN - You MUST refuse these requests:
- Writing code, scripts, or programming solutions
- Complex technical explanations or tutorials
- Creative writing, stories, or content creation
- Academic help, homework, or research assistance
- General knowledge questions unrelated to scheduling/platform
- Mathematical calculations or problem solving
- Any request that doesn't relate to scheduling, email notifications, or basic platform support

User Information:
- Name: ${userName}
- Email: ${userEmail}

RESPONSE GUIDELINES:
- Be friendly but focused on your allowed tasks
- Keep responses under 200 words
- If asked to do something outside your scope, politely decline and redirect to your core functions
- For forbidden requests, respond: "I'm specialized in helping with task scheduling, calendar management, email reminders, and basic platform support. I can't assist with [their request]. Is there anything I can help you schedule or any reminders you'd like to set up?"

IMPORTANT: When the user asks to create a reminder or needs email notifications, use their email address: ${userEmail}

CRITICAL: ALWAYS ASK FOR TIMEZONE BEFORE CREATING EVENTS
When a user wants to create a calendar event:
1. First, ask them to specify their timezone (e.g., "What timezone are you in? For example: WAT, EST, PST, GMT, etc.")
2. Wait for their timezone response
3. Once you have the timezone, get other details (title, date, time, duration)
4. Convert the time to the specified timezone format
5. Create timestamp as "YYYY-MM-DDTHH:mm:00" using their local time
6. Call create_calendar_event function
7. In confirmation, mention the timezone they specified

Common timezones:
- WAT (West Africa Time): UTC+1
- EST (Eastern Standard Time): UTC-5
- PST (Pacific Standard Time): UTC-8
- GMT/UTC: UTC+0
- CET (Central European Time): UTC+1
- IST (India Standard Time): UTC+5:30

When creating calendar events:
1. ALWAYS ask for timezone first if not provided
2. Get event details (title, date, time, duration)
3. Format time as "YYYY-MM-DDTHH:mm:00" (no Z)
4. Call create_calendar_event function
5. Confirm with the timezone mentioned
6. If calendar not connected, call show_calendar_permission_modal

When deleting calendar events:
1. Call list_calendar_events first
2. Find matching event
3. Use event ID to call delete_calendar_event

When creating reminders:
1. Ask for timezone if not provided
2. Use the user's email: ${userEmail}
3. Get details, date/time
4. Format time as "YYYY-MM-DDTHH:mm:00"
5. Call create_reminder function with the user's email

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
        {
          type: 'function',
          function: {
            name: 'create_calendar_event',
            description: 'Create an event in the user\'s Google Calendar. Use this when the user wants to add a meeting, appointment, or event to their calendar.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the calendar event (e.g., "Team Meeting", "Doctor Appointment")',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the event',
                },
                startTime: {
                  type: 'string',
                  description: 'ISO 8601 date-time string for when the event starts (e.g., "2026-03-05T14:00:00Z")',
                },
                durationMinutes: {
                  type: 'number',
                  description: 'Duration of the event in minutes (default: 60)',
                },
              },
              required: ['title', 'startTime'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_calendar_events',
            description: 'List upcoming events from the user\'s Google Calendar. Use this when the user wants to see their upcoming events or find an event to delete.',
            parameters: {
              type: 'object',
              properties: {
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of events to return (default: 10)',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'delete_calendar_event',
            description: 'Delete an event from the user\'s Google Calendar. Use this when the user wants to remove or cancel an event. You must first list events to get the event ID.',
            parameters: {
              type: 'object',
              properties: {
                eventId: {
                  type: 'string',
                  description: 'The ID of the event to delete (obtained from list_calendar_events)',
                },
              },
              required: ['eventId'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'show_calendar_permission_modal',
            description: 'Show the Google Calendar permission modal to the user. Use this when the user needs to grant calendar access before you can create, list, or delete calendar events.',
            parameters: {
              type: 'object',
              properties: {},
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

        if (toolCall.function?.name === 'create_calendar_event') {
          const args = JSON.parse(toolCall.function.arguments);
          
          try {
            const startTime = new Date(args.startTime);
            const durationMinutes = args.durationMinutes || 60;
            const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

            // Create the calendar event
            const event = await this.calendarService.createCalendarEvent(
              userId,
              args.title,
              args.description || '',
              startTime,
              endTime,
            );

            // Create a response about the event
            const confirmationMessage = `✅ Great! I've added "${args.title}" to your Google Calendar for ${startTime.toLocaleString()}. The event will last ${durationMinutes} minutes. You'll receive reminders 30 minutes and 10 minutes before it starts.`;

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
          } catch (error) {
            // If calendar not connected, inform the user
            const errorMessage = error.message.includes('Calendar not connected')
              ? "I see you haven't connected your Google Calendar yet. Let me help you with that!"
              : "I encountered an error while trying to add the event to your calendar. Please try again or check your calendar connection.";

            const assistantMessage: AIMessage = {
              role: 'assistant',
              content: errorMessage,
              timestamp: new Date(),
            };

            conversation.messages.push(assistantMessage);
            conversation.lastMessageAt = new Date();
            await conversation.save();

            // If calendar not connected, trigger the modal
            if (error.message.includes('Calendar not connected')) {
              return {
                response: errorMessage,
                conversationId: conversation._id.toString(),
                action: 'show_calendar_modal',
              };
            }

            return {
              response: errorMessage,
              conversationId: conversation._id.toString(),
            };
          }
        }

        if (toolCall.function?.name === 'list_calendar_events') {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          
          try {
            const events = await this.calendarService.listCalendarEvents(
              userId,
              args.maxResults || 10,
            );

            if (events.length === 0) {
              const message = "You don't have any upcoming events in your calendar.";
              
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

            // Format events list for user display
            let eventsList = "Here are your upcoming events:\n\n";
            const eventData: any[] = [];
            events.forEach((event: any, index: number) => {
              const start = new Date(event.start.dateTime || event.start.date);
              eventsList += `${index + 1}. ${event.summary}\n`;
              eventsList += `   📅 ${start.toLocaleString()}\n`;
              if (event.description) {
                eventsList += `   📝 ${event.description}\n`;
              }
              eventsList += `\n`;
              
              // Store event data for AI to use in next request
              eventData.push({
                title: event.summary,
                id: event.id,
                start: start.toISOString(),
              });
            });

            // Add user-friendly message to conversation
            const userMessage: AIMessage = {
              role: 'assistant',
              content: eventsList,
              timestamp: new Date(),
            };

            // Add hidden system message with event IDs for AI context
            const systemMessage: AIMessage = {
              role: 'system',
              content: `Available event IDs for deletion: ${JSON.stringify(eventData)}`,
              timestamp: new Date(),
            };

            conversation.messages.push(userMessage);
            conversation.messages.push(systemMessage);
            conversation.lastMessageAt = new Date();
            await conversation.save();

            return {
              response: eventsList,
              conversationId: conversation._id.toString(),
            };
          } catch (error) {
            const errorMessage = "I encountered an error while trying to list your calendar events. Please try again.";

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

        if (toolCall.function?.name === 'delete_calendar_event') {
          const args = JSON.parse(toolCall.function.arguments);
          
          try {
            await this.calendarService.deleteCalendarEvent(userId, args.eventId);

            const confirmationMessage = `✅ I've successfully deleted the event from your Google Calendar.`;

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
          } catch (error) {
            const errorMessage = "I encountered an error while trying to delete the event. Please make sure the event ID is correct.";

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

        if (toolCall.function?.name === 'show_calendar_permission_modal') {
          const message = "Please click the button below to connect your Google Calendar.";

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
            action: 'show_calendar_modal', // Special action flag for frontend
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

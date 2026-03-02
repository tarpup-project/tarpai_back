import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    
    if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://tarpai.onrender.com',
          'X-Title': 'TarpAI Chat',
        },
      });
      console.log('OpenRouter AI initialized successfully');
    } else {
      console.log('OpenRouter API key not configured, AI features disabled');
    }
  }

  async isMessageUrgent(messageContent: string): Promise<boolean> {
    if (!messageContent || messageContent.trim().length === 0) {
      return false;
    }

    const lowerContent = messageContent.toLowerCase();

    // First, check for explicit urgency keywords (guaranteed urgent)
    const urgencyKeywords = [
      'urgent', 'urgently', 'emergency', 'asap', 'immediately', 'quickly',
      'right now', 'right away', 'hurry', 'fast', 'critical', 'crisis',
      'chaos', 'help', 'sos', 'alert', 'warning', 'danger'
    ];

    const hasUrgencyKeyword = urgencyKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );

    if (hasUrgencyKeyword) {
      console.log('Message contains urgency keyword, marking as URGENT');
      return true;
    }

    // Check for time-sensitive phrases (guaranteed urgent)
    const timeSensitivePatterns = [
      'tomorrow', 'today', 'tonight', 'this evening', 'this morning',
      'next week', 'next month', 'this week', 'in \\d+ (minute|hour|day)',
      'by (tomorrow|today|tonight)', 'before (tomorrow|today)',
      'deadline', 'due date', 'expires'
    ];

    const hasTimeSensitive = timeSensitivePatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(lowerContent);
    });

    if (hasTimeSensitive) {
      console.log('Message contains time-sensitive phrase, marking as URGENT');
      return true;
    }

    // Check for important occasions/events (guaranteed urgent)
    const occasionKeywords = [
      'wedding', 'marriage', 'married', 'marry', 'funeral', 'burial',
      'graduation', 'interview', 'meeting', 'appointment', 'conference',
      'party', 'celebration', 'ceremony', 'event', 'birthday'
    ];

    const hasOccasion = occasionKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );

    if (hasOccasion) {
      console.log('Message contains occasion/event keyword, marking as URGENT');
      return true;
    }

    // Check for action-required phrases
    const actionPatterns = [
      'i need', 'we need', 'need to', 'must', 'have to', 'got to',
      'please come', 'come now', 'come quickly', 'call me', 'text me'
    ];

    const hasActionRequired = actionPatterns.some(pattern => 
      lowerContent.includes(pattern)
    );

    if (hasActionRequired) {
      console.log('Message requires immediate action, marking as URGENT');
      return true;
    }

    // If no keywords matched, use AI as backup for edge cases
    if (!this.openai) {
      console.log('AI not configured and no urgency keywords found, treating as non-urgent');
      return false;
    }

    try {
      console.log('No urgency keywords found, checking with AI:', messageContent.substring(0, 50) + '...');
      
      const completion = await this.openai.chat.completions.create({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an AI that analyzes messages to determine if they are urgent or important. 

Urgent/important messages include:
- Emergency situations (fire, accident, danger, help needed, crisis, chaos)
- Time-sensitive requests with specific timeframes (tomorrow, today, tonight, next week, in 5 minutes, deadline, ASAP)
- Messages containing the word "urgent" or "urgently" or "emergency"
- Important life events and occasions (wedding, marriage, funeral, birth, graduation, interview)
- Critical meetings or appointments (meeting tomorrow, appointment today, interview)
- Requests for immediate action (need now, need urgently, come quickly)
- Important activities or events happening soon
- Serious problems requiring attention

NOT urgent messages include:
- Casual greetings without time pressure (hi, hello, how are you, what's up)
- General small talk (weather, sports, casual updates)
- Questions without urgency (what do you think about...)
- Friendly conversations without time constraints
- General statements without action needed

Key indicators of urgency:
- Words like: urgent, urgently, emergency, ASAP, now, immediately, quickly
- Time references: tomorrow, today, tonight, next week, this evening, in X minutes/hours
- Occasions: wedding, marriage, funeral, party, celebration, interview, meeting
- Action words with urgency: need, must, have to, required

Respond with ONLY "YES" if the message is urgent/important, or "NO" if it's not urgent.`
          },
          {
            role: 'user',
            content: `Is this message urgent or important? Message: "${messageContent}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 10,
      });

      const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
      const isUrgent = response === 'YES';
      
      console.log('AI urgency analysis result:', isUrgent ? 'URGENT' : 'NOT URGENT');
      return isUrgent;
    } catch (error) {
      console.error('Error analyzing message urgency:', error);
      // On error, default to non-urgent to avoid spam
      return false;
    }
  }
    async shouldAutoReply(messageContent: string): Promise<boolean> {
      if (!messageContent || messageContent.trim().length === 0) {
        return false;
      }

      const lowerContent = messageContent.toLowerCase();

      // Check if message is urgent first - don't auto-reply to urgent messages
      const isUrgent = await this.isMessageUrgent(messageContent);
      if (isUrgent) {
        console.log('Message is urgent, skipping auto-reply');
        return false;
      }

      // Patterns that typically warrant auto-replies (casual, non-urgent messages)
      const autoReplyPatterns = [
        // Greetings
        'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
        'good night', 'greetings', 'what\'s up', 'whats up', 'wassup',

        // Casual check-ins
        'how are you', 'how\'s it going', 'how is it going', 'how you doing',
        'how are things', 'how\'s everything', 'how is everything',
        'hope you\'re well', 'hope you are well', 'hope you\'re good',
        'hope you are good', 'hope all is well',

        // Work/life casual inquiries
        'how\'s work', 'how is work', 'how\'s your day', 'how is your day',
        'how was your day', 'how\'s life', 'how is life', 'what\'s new',
        'whats new', 'any updates', 'anything new',

        // Simple questions without urgency
        'how have you been', 'long time no see', 'been a while',
        'thinking of you', 'just checking in', 'checking in',

        // Weekend/time-based casual messages
        'happy weekend', 'enjoy your weekend', 'have a good weekend',
        'happy friday', 'tgif', 'how\'s your weekend'
      ];

      const hasAutoReplyPattern = autoReplyPatterns.some(pattern =>
        lowerContent.includes(pattern)
      );

      if (hasAutoReplyPattern) {
        console.log('Message matches auto-reply pattern');
        return true;
      }

      // Use AI to determine if it's a casual message that warrants auto-reply
      if (!this.openai) {
        console.log('AI not configured, using pattern matching only');
        return false;
      }

      try {
        console.log('Checking if message should get auto-reply with AI:', messageContent.substring(0, 50) + '...');

        const completion = await this.openai.chat.completions.create({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an AI that determines if a casual, non-urgent message should receive an automatic reply when someone is unavailable.

  Messages that SHOULD get auto-replies:
  - Casual greetings (hi, hello, hey, good morning)
  - General check-ins (how are you, how's it going, hope you're well)
  - Casual work/life questions (how's work, how's your day, what's new)
  - Friendly conversation starters without urgency
  - Simple social messages (thinking of you, long time no see)
  - General well-wishes (have a good day, enjoy your weekend)

  Messages that should NOT get auto-replies:
  - Urgent or important messages (emergencies, deadlines, meetings)
  - Specific questions requiring detailed answers
  - Business or work-related requests
  - Messages asking for specific information or help
  - Complex topics or serious discussions
  - Messages that already seem like responses to something

  Respond with ONLY "YES" if the message should get an auto-reply, or "NO" if it shouldn't.`
            },
            {
              role: 'user',
              content: `Should this casual message get an auto-reply? Message: "${messageContent}"`
            }
          ],
          temperature: 0.3,
          max_tokens: 10,
        });

        const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
        const shouldReply = response === 'YES';

        console.log('AI auto-reply decision:', shouldReply ? 'YES' : 'NO');
        return shouldReply;
      } catch (error) {
        console.error('Error determining auto-reply eligibility:', error);
        return false;
      }
    }

    async generateAutoReply(messageContent: string, recipientName: string, senderName: string): Promise<string> {
      if (!this.openai) {
        // Fallback responses if AI is not configured
        const fallbackResponses = [
          `Hi ${senderName}! Thanks for reaching out. I'm not available right now, but I'll get back to you soon! 😊`,
          `Hey ${senderName}! I'm doing well, thanks for asking! Currently away but will respond when I'm back.`,
          `Hello ${senderName}! Hope you're doing great too! I'm not available at the moment but will catch up with you later.`,
          `Hi there ${senderName}! Thanks for checking in. I'm away right now but will get back to you soon!`
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      }

      try {
        console.log('Generating auto-reply for message:', messageContent.substring(0, 50) + '...');

        const completion = await this.openai.chat.completions.create({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that generates friendly, casual auto-replies for when someone is unavailable to respond to messages.

  Guidelines for auto-replies:
  - Keep responses warm, friendly, and casual
  - Acknowledge the sender by name (${senderName})
  - Indicate that ${recipientName} is currently unavailable
  - Promise to get back to them soon
  - Match the tone of the original message (casual, friendly)
  - Keep responses brief (1-2 sentences max)
  - Use appropriate emojis sparingly (😊, 👋, etc.)
  - Don't make specific commitments about when they'll respond
  - Don't answer specific questions - just acknowledge the message

  Examples:
  - For "Hi, how are you?" → "Hi ${senderName}! I'm doing well, thanks for asking! ${recipientName} is away right now but will get back to you soon 😊"
  - For "Hope you're having a good day" → "Thanks ${senderName}! Hope you're having a great day too! I'm not available at the moment but will catch up with you later 👋"
  - For "What's up?" → "Hey ${senderName}! Not much, just staying busy! ${recipientName} is away right now but will respond when back."

  Generate a friendly auto-reply response.`
            },
            {
              role: 'user',
              content: `Generate an auto-reply for this message from ${senderName} to ${recipientName}: "${messageContent}"`
            }
          ],
          temperature: 0.7,
          max_tokens: 100,
        });

        const autoReply = completion.choices[0]?.message?.content?.trim();

        if (!autoReply) {
          throw new Error('No auto-reply generated');
        }

        console.log('Generated auto-reply:', autoReply);
        return autoReply;
      } catch (error) {
        console.error('Error generating auto-reply:', error);
        // Fallback response
        return `Hi ${senderName}! Thanks for your message. ${recipientName} is not available right now but will get back to you soon! 😊`;
      }
    }
}

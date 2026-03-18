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

    const lowerMessage = messageContent.toLowerCase();
    
    // Emergency situations
    const emergencyKeywords = [
      'fire', 'accident', 'danger', 'help needed', 'crisis', 'chaos',
      'medical emergency', 'police', 'emergency', 'urgent', 'urgently',
      'asap', 'immediately', 'right now'
    ];
    
    // Time-sensitive keywords
    const timeSensitiveKeywords = [
      'today', 'tonight', 'tomorrow', 'in 5 minutes', 'deadline',
      'in an hour', 'this morning', 'this afternoon', 'this evening'
    ];
    
    // Important life events
    const importantEvents = [
      'wedding', 'marriage', 'funeral', 'birth', 'graduation', 'interview'
    ];
    
    // Critical meetings/appointments
    const criticalMeetings = [
      'meeting tomorrow', 'appointment today', 'interview tomorrow',
      'doctor appointment today', 'surgery', 'court', 'legal'
    ];
    
    // Immediate action requests
    const immediateActions = [
      'need help now', 'come quickly', 'please respond urgently',
      'must be done today', 'system failure', 'security breach',
      'lost passport', 'missed deadline'
    ];
    
    // Check for emergency keywords
    for (const keyword of emergencyKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.log('Message contains emergency keyword, marking as URGENT');
        return true;
      }
    }
    
    // Check for time-sensitive keywords
    for (const keyword of timeSensitiveKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.log('Message contains time-sensitive keyword, marking as URGENT');
        return true;
      }
    }
    
    // Check for important events
    for (const event of importantEvents) {
      if (lowerMessage.includes(event)) {
        console.log('Message contains important event keyword, marking as URGENT');
        return true;
      }
    }
    
    // Check for critical meetings
    for (const meeting of criticalMeetings) {
      if (lowerMessage.includes(meeting)) {
        console.log('Message contains critical meeting keyword, marking as URGENT');
        return true;
      }
    }
    
    // Check for immediate actions
    for (const action of immediateActions) {
      if (lowerMessage.includes(action)) {
        console.log('Message contains immediate action keyword, marking as URGENT');
        return true;
      }
    }
    
    console.log('Message does not contain urgency indicators, marking as NOT URGENT');
    return false;
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

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
}

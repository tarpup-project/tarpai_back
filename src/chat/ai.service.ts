import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    
    if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://tarpup.ai',
          'X-Title': 'TarpAI Chat',
        },
      });
      console.log('OpenRouter AI initialized successfully');
    } else {
      console.log('OpenRouter API key not configured, AI features disabled');
    }
  }

  async isMessageUrgent(messageContent: string): Promise<{ isUrgent: boolean; keywords: string[] }> {
    if (!messageContent || messageContent.trim().length === 0) {
      return { isUrgent: false, keywords: [] };
    }

    const lowerMessage = messageContent.toLowerCase();
    const detectedKeywords: string[] = [];
    
    // Emergency situations
    const emergencyKeywords = [
      'fire', 'accident', 'danger', 'help needed', 'crisis', 'chaos',
      'medical emergency', 'police', 'emergency', 'urgent', 'urgently',
      'asap', 'immediately', 'right now', 'help me', 'help please'
    ];
    
    // Time-sensitive keywords
    const timeSensitiveKeywords = [
      'today', 'tonight', 'tomorrow', 'in 5 minutes', 'deadline',
      'in an hour', 'this morning', 'this afternoon', 'this evening',
      'next week', 'this week', 'next month'
    ];
    
    // Days of the week (scheduling indicators)
    const dayKeywords = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
    ];
    
    // Months (scheduling indicators)
    const monthKeywords = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    
    // Meeting/occasion keywords
    const meetingKeywords = [
      'meet up', 'meetup', 'meeting', 'appointment', 'date', 'hangout',
      'get together', 'catch up', 'see you', 'lets meet', 'let\'s meet',
      'coffee', 'lunch', 'dinner', 'drinks', 'party', 'event'
    ];
    
    // Important life events
    const importantEvents = [
      'wedding', 'marriage', 'funeral', 'birth', 'graduation', 'interview',
      'appointment', 'surgery', 'court', 'legal'
    ];
    
    // Critical meetings/appointments
    const criticalMeetings = [
      'meeting tomorrow', 'appointment today', 'interview tomorrow',
      'doctor appointment today', 'surgery', 'court', 'legal',
      'appointment next week', 'meeting next week', 'we have an appointment'
    ];
    
    // Immediate action requests
    const immediateActions = [
      'need help now', 'come quickly', 'please respond urgently',
      'must be done today', 'system failure', 'security breach',
      'lost passport', 'missed deadline'
    ];
    
    let isUrgent = false;
    
    // Check for emergency keywords
    for (const keyword of emergencyKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.log('Message contains emergency keyword, marking as URGENT');
        detectedKeywords.push(keyword);
        isUrgent = true;
      }
    }
    
    // Check for time-sensitive keywords
    for (const keyword of timeSensitiveKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.log('Message contains time-sensitive keyword, marking as URGENT');
        detectedKeywords.push(keyword);
        isUrgent = true;
      }
    }
    
    // Check for important events
    for (const event of importantEvents) {
      if (lowerMessage.includes(event)) {
        console.log('Message contains important event keyword, marking as URGENT');
        detectedKeywords.push(event);
        isUrgent = true;
      }
    }
    
    // Check for critical meetings
    for (const meeting of criticalMeetings) {
      if (lowerMessage.includes(meeting)) {
        console.log('Message contains critical meeting keyword, marking as URGENT');
        detectedKeywords.push(meeting);
        isUrgent = true;
      }
    }
    
    // Check for immediate actions
    for (const action of immediateActions) {
      if (lowerMessage.includes(action)) {
        console.log('Message contains immediate action keyword, marking as URGENT');
        detectedKeywords.push(action);
        isUrgent = true;
      }
    }
    
    // NEW: Check for scheduling patterns (day + meeting/occasion)
    const hasDayReference = dayKeywords.some(day => lowerMessage.includes(day));
    const hasMonthReference = monthKeywords.some(month => lowerMessage.includes(month));
    const hasMeetingReference = meetingKeywords.some(meeting => lowerMessage.includes(meeting));
    
    // Check for time patterns (e.g., "2 PM", "at 3", "10:30")
    const timePatterns = [
      /\b\d{1,2}:\d{2}\b/,           // 2:30, 10:45
      /\b\d{1,2}\s?(am|pm)\b/i,     // 2 PM, 3am
      /\bat\s?\d{1,2}\b/,           // at 2, at 10
      /\b\d{1,2}\s?o'?clock\b/i     // 2 oclock, 3 o'clock
    ];
    
    const hasTimeReference = timePatterns.some(pattern => pattern.test(lowerMessage));
    
    // Check for date patterns (e.g., "March 15", "15th", "next Tuesday")
    const datePatterns = [
      /\b\d{1,2}(st|nd|rd|th)\b/,   // 15th, 22nd, 3rd
      /\b\d{1,2}\/\d{1,2}\b/,       // 3/15, 12/25
      /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
    ];
    
    const hasDateReference = datePatterns.some(pattern => pattern.test(lowerMessage));
    
    // Check for future-oriented language that suggests planning/scheduling
    const schedulingVerbs = [
      'let\'s', 'lets', 'can we', 'shall we', 'would you', 'are you free',
      'are you available', 'want to', 'wanna', 'should we', 'how about'
    ];
    
    const hasSchedulingLanguage = schedulingVerbs.some(verb => lowerMessage.includes(verb));
    
    // If message contains scheduling elements (day/date/time + meeting/occasion), mark as urgent
    if ((hasDayReference || hasMonthReference || hasDateReference || hasTimeReference) && hasMeetingReference) {
      console.log('Message contains scheduling pattern (date/time + meeting/occasion), marking as URGENT');
      detectedKeywords.push('scheduling_pattern');
      isUrgent = true;
    }
    
    // Also check for scheduling inquiries with future-oriented language
    if ((hasDayReference || hasDateReference) && hasSchedulingLanguage) {
      console.log('Message contains scheduling inquiry pattern, marking as URGENT');
      detectedKeywords.push('scheduling_inquiry');
      isUrgent = true;
    }
    
    // Exclude casual past references that shouldn't be urgent
    const pastTenseIndicators = [
      'had', 'was', 'were', 'went', 'did', 'yesterday', 'last week', 'last month',
      'ago', 'before', 'earlier', 'previously'
    ];
    
    const hasPastReference = pastTenseIndicators.some(past => lowerMessage.includes(past));
    
    // Exclude casual present references that shouldn't be urgent (weather, general statements)
    const casualPresentIndicators = [
      'weather', 'nice', 'beautiful', 'sunny', 'rainy', 'cold', 'hot',
      'feeling', 'love', 'like', 'enjoy', 'think', 'believe'
    ];
    
    const hasCasualReference = casualPresentIndicators.some(casual => lowerMessage.includes(casual));
    
    // If it's a past reference or casual statement without scheduling language, don't mark time-sensitive words as urgent
    if ((hasPastReference || hasCasualReference) && !hasSchedulingLanguage && !hasMeetingReference) {
      // Remove time-sensitive keywords that were detected for past events or casual statements
      const timeKeywordsToRemove = ['today', 'this morning', 'this afternoon', 'this evening'];
      for (const keyword of timeKeywordsToRemove) {
        if (detectedKeywords.includes(keyword) && lowerMessage.includes(keyword)) {
          const index = detectedKeywords.indexOf(keyword);
          if (index > -1) {
            detectedKeywords.splice(index, 1);
            console.log(`Removed '${keyword}' from urgent keywords due to ${hasPastReference ? 'past tense' : 'casual'} context`);
          }
        }
      }
      
      // If no other urgent keywords remain, mark as not urgent
      if (detectedKeywords.length === 0) {
        isUrgent = false;
        console.log(`Message contains ${hasPastReference ? 'past tense' : 'casual'} reference, removing urgency`);
      }
    }
    
    if (!isUrgent) {
      console.log('Message does not contain urgency indicators, marking as NOT URGENT');
    }
    
    return { isUrgent, keywords: detectedKeywords };
  }
    async shouldAutoReply(messageContent: string): Promise<boolean> {
      if (!messageContent || messageContent.trim().length === 0) {
        return false;
      }

      const lowerContent = messageContent.toLowerCase();

      // Check if message is urgent first - don't auto-reply to urgent messages
      const urgencyResult = await this.isMessageUrgent(messageContent);
      if (urgencyResult.isUrgent) {
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
          `Hi ${senderName}! Thanks for reaching out. I'm not available right now, but I'll get back to you soon! 😊\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`,
          `Hey ${senderName}! I'm doing well, thanks for asking! Currently away but will respond when I'm back.\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`,
          `Hello ${senderName}! Hope you're doing great too! I'm not available at the moment but will catch up with you later.\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`,
          `Hi there ${senderName}! Thanks for checking in. I'm away right now but will get back to you soon!\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`
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

        // Add the important message statement
        const finalAutoReply = `${autoReply}\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`;

        console.log('Generated auto-reply:', finalAutoReply);
        return finalAutoReply;
      } catch (error) {
        console.error('Error generating auto-reply:', error);
        // Fallback response
        return `Hi ${senderName}! Thanks for your message. ${recipientName} is not available right now but will get back to you soon! 😊\n\nBut if you have an important message, you can leave it here and I'll be notified right away! 📱`;
      }
    }
}

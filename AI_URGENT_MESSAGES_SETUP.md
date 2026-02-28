# AI-Powered Urgent Message Email Notifications

## Overview
Integrated OpenRouter AI to analyze chat messages and automatically send email notifications for urgent/important messages to ALL users, while regular messages only trigger emails for silent signup users.

## Features

### 1. AI Message Analysis
- Uses OpenRouter AI (GPT-3.5 Turbo) to analyze message content
- Detects urgent/important messages including:
  - Emergency situations (fire, accident, danger, help needed, crisis, chaos)
  - Time-sensitive requests (tomorrow, today, tonight, next week, ASAP, deadline)
  - Messages containing "urgent", "urgently", or "emergency"
  - Important life events and occasions (wedding, marriage, funeral, graduation, interview)
  - Critical meetings or appointments
  - Requests for immediate action (need now, need urgently)
  - Important activities or events happening soon

### 2. Smart Email Notifications
- **Urgent Messages**: ALL users receive email notifications (regardless of silent signup status)
- **Regular Messages**: Only silent signup users receive email notifications
- Urgent emails have special styling with red theme and warning indicators

### 3. User Upgrade Logic
- Silent signup users are upgraded to normal users when:
  1. They log in with Google OAuth
  2. They send 2+ messages in any conversation

## Setup Instructions

### 1. Get OpenRouter API Key
1. Go to https://openrouter.ai/
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

### 2. Configure Environment Variable
Add your OpenRouter API key to `.env`:
```env
OPENROUTER_API_KEY="sk-or-v1-your-actual-api-key-here"
```

### 3. Restart Backend Server
```bash
npm run start:dev
```

## How It Works

### Message Flow
1. User sends a message in chat
2. Backend receives message via `ChatService.sendMessage()`
3. AI analyzes message content for urgency (only for text messages)
4. Message is saved to database
5. For each recipient:
   - If message is URGENT: Send urgent email to ALL users
   - If message is REGULAR: Send email only to silent signup users
6. Real-time notification sent via WebSocket

### AI Analysis
The AI uses a carefully crafted system prompt to determine urgency:
- Temperature: 0.3 (for consistent results)
- Max tokens: 10 (simple YES/NO response)
- Model: openai/gpt-3.5-turbo (fast, reliable, and very affordable)

### Email Templates
- **Urgent Email**: Red theme, warning icons, "View & Respond Now" CTA
- **Regular Email**: Purple theme, casual tone, "View Message" CTA

## Files Modified

### New Files
- `src/chat/ai.service.ts` - AI service for message urgency analysis
- `AI_URGENT_MESSAGES_SETUP.md` - This documentation

### Modified Files
- `src/chat/chat.service.ts` - Added AI urgency check and email logic
- `src/chat/chat.module.ts` - Added AiService provider
- `src/auth/email.service.ts` - Added sendUrgentMessageNotification method
- `.env` - Added OPENROUTER_API_KEY configuration
- `package.json` - Added openai package dependency

## Testing

### Test Urgent Message
Send a message like:
- "There's something urgent my friend"
- "I'm getting married tomorrow"
- "I need my bag urgently"
- "We have a meeting tomorrow"
- "Emergency! I need help immediately"
- "IMPORTANT: Meeting in 5 minutes"
- "There's chaos at the office"
- "Interview tomorrow at 9am"

### Test Regular Message
Send a message like:
- "Hey, how are you?"
- "What's up?"
- "Did you see the game last night?"

### Check Logs
Monitor console for:
```
Analyzing message urgency with AI: [message preview]
AI urgency analysis result: URGENT
Message urgency check: URGENT
Message is URGENT, sending urgent email notification to: [email]
Urgent email notification sent successfully
```

## Cost Considerations
- Using paid tier model: `openai/gpt-3.5-turbo`
- Very affordable: ~$0.0005 per message analysis (less than a penny per 20 messages)
- Reliable and fast with 99.9% uptime
- Can switch to other models if needed (GPT-4, Claude, etc.)

## Fallback Behavior
- If OpenRouter API key is not configured: All messages treated as non-urgent
- If AI analysis fails: Message treated as non-urgent (to avoid spam)
- If email service fails: Error logged but message still sent via chat

## Future Enhancements
- Add user preferences for email notification frequency
- Allow users to opt-out of urgent email notifications
- Add more sophisticated urgency detection (sentiment analysis, context awareness)
- Support for multiple languages
- Rate limiting for email notifications

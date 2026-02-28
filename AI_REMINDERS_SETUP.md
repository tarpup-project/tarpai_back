# TarpAI Reminder System

## Overview
The TarpAI assistant now has the ability to create reminders and schedule meetings with email notifications. The AI uses function calling to intelligently extract reminder details from natural conversation.

## Features

### 1. Natural Language Reminder Creation
Users can create reminders by simply chatting with TarpAI:
- "Remind me to call John tomorrow at 2pm"
- "Set up a meeting reminder for next Monday at 10am"
- "I need a reminder for my doctor's appointment on March 5th at 3:30pm"

### 2. Email Notifications
- Reminders are sent via email at the scheduled time
- Beautiful HTML email template with reminder details
- Includes title, description, and scheduled time

### 3. Automatic Scheduling
- Cron job runs every minute to check for due reminders
- Automatically sends emails when reminders are due
- Marks reminders as sent to prevent duplicates

## How It Works

### Backend Architecture

1. **Reminder Schema** (`src/ai/reminder.schema.ts`)
   - Stores reminder details in MongoDB
   - Fields: userId, title, description, email, scheduledFor, sent, status

2. **Reminder Service** (`src/ai/reminder.service.ts`)
   - Creates and manages reminders
   - Cron job checks for due reminders every minute
   - Sends email notifications using EmailService

3. **AI Chat Service** (`src/ai/ai-chat.service.ts`)
   - Enhanced with function calling capability
   - AI can call `create_reminder` function
   - Extracts reminder details from conversation

4. **API Endpoints**
   - `POST /ai/chat` - Chat with AI (can create reminders)
   - `GET /ai/reminders` - Get user's reminders
   - `DELETE /ai/reminders/:id` - Delete a reminder

### AI Function Calling

The AI has access to a `create_reminder` function with these parameters:
- `title` (required): Short title for the reminder
- `description` (optional): Detailed description
- `email` (required): Email address for notification
- `scheduledFor` (required): ISO 8601 date-time string

### Example Conversation Flow

**User:** "Remind me about the team meeting tomorrow at 2pm. My email is user@example.com"

**AI Process:**
1. Extracts: title="Team Meeting", email="user@example.com", time="tomorrow at 2pm"
2. Converts time to ISO 8601 format
3. Calls `create_reminder` function
4. Confirms: "✅ Perfect! I've scheduled your reminder 'Team Meeting' for [date/time]. You'll receive an email at user@example.com when it's time."

## Usage Examples

### Creating a Simple Reminder
```
User: "Remind me to submit the report on Friday at 5pm. Email: john@example.com"
AI: "✅ Perfect! I've scheduled your reminder 'Submit Report' for Friday, March 1, 2026 at 5:00 PM. You'll receive an email at john@example.com when it's time."
```

### Creating a Meeting Reminder
```
User: "I have a client meeting next Monday at 10am. Can you remind me? My email is sarah@example.com"
AI: "✅ Perfect! I've scheduled your reminder 'Client Meeting' for Monday, March 4, 2026 at 10:00 AM. You'll receive an email at sarah@example.com when it's time."
```

### AI Asking for Missing Information
```
User: "Remind me about the dentist appointment"
AI: "I'd be happy to help! When is your dentist appointment scheduled? And what email should I send the reminder to?"
User: "It's on March 10th at 2:30pm. Email is mike@example.com"
AI: "✅ Perfect! I've scheduled your reminder 'Dentist Appointment' for March 10, 2026 at 2:30 PM. You'll receive an email at mike@example.com when it's time."
```

## Email Template

The reminder email includes:
- Professional header with TarpAI branding
- Reminder title and description
- Scheduled date/time
- Clean, responsive design

## Technical Details

### Cron Job
- Runs every minute: `@Cron(CronExpression.EVERY_MINUTE)`
- Queries for reminders where `scheduledFor <= now` and `status = 'pending'`
- Sends email and updates status to 'sent'
- Handles failures gracefully (status = 'failed')

### Date Handling
- AI converts natural language dates to ISO 8601 format
- System uses user's timezone (can be enhanced with timezone support)
- Current date/time is provided to AI in system prompt

### Security
- All endpoints require JWT authentication
- Users can only access their own reminders
- Email addresses are validated

## Future Enhancements

Possible improvements:
1. Timezone support for international users
2. Recurring reminders (daily, weekly, monthly)
3. SMS notifications in addition to email
4. Calendar integration (Google Calendar, Outlook)
5. Reminder snooze functionality
6. In-app notifications
7. Reminder templates for common events
8. Bulk reminder management

## Testing

To test the reminder system:

1. Chat with TarpAI: "Remind me to test this feature in 2 minutes. Email: your@email.com"
2. Wait 2 minutes
3. Check your email for the reminder notification

## Dependencies

- `@nestjs/schedule` - For cron job scheduling
- `nodemailer` - For sending emails (via EmailService)
- `openai` - For AI function calling with OpenRouter

## Configuration

Required environment variables:
- `OPENROUTER_API_KEY` - For AI chat functionality
- Email configuration (already set up in EmailService)

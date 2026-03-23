import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AiService } from '../chat/ai.service';

async function testUrgencyDetection() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const aiService = app.get(AiService);

  console.log('Testing enhanced urgency detection...');

  // Test messages that should be detected as urgent
  const urgentMessages = [
    // Original example
    'Hey Shipper lets meet up on Tuesday',
    
    // Date + occasion patterns
    'Can we meet for coffee on Friday?',
    'Let\'s have lunch tomorrow at 2 PM',
    'Are you free for dinner on Saturday?',
    'Meeting at 3:30 PM today',
    'Appointment on March 15th',
    'Let\'s catch up this Thursday',
    'Party on the 25th, are you coming?',
    'Coffee date next Monday?',
    'Hangout this weekend?',
    
    // Time patterns
    'See you at 10 AM',
    'Meeting at 2:30',
    'Lunch at 12 o\'clock',
    'Call me at 5pm',
    
    // Scheduling inquiries
    'Can we meet next Tuesday?',
    'Are you available on Wednesday?',
    'Let\'s schedule for Thursday',
    
    // Traditional urgent messages
    'Emergency! Need help now',
    'Urgent: deadline today',
    'Doctor appointment tomorrow'
  ];

  // Test messages that should NOT be urgent
  const nonUrgentMessages = [
    'How are you doing?',
    'Thanks for the help yesterday',
    'I love Tuesdays',
    'What\'s your favorite day of the week?',
    'I had coffee this morning',        // Past tense - should not be urgent
    'The meeting went well',            // Past tense - should not be urgent
    'Hope you have a great weekend',
    'Just saying hello',
    'Nice weather today',               // Casual mention - should not be urgent
    'I went to lunch yesterday',        // Past tense - should not be urgent
    'Tuesday was a good day',           // Past tense - should not be urgent
    'I was at the office this morning', // Past tense - should not be urgent
    'The party last week was fun'       // Past tense - should not be urgent
  ];

  console.log('\n=== Testing URGENT messages ===');
  for (const message of urgentMessages) {
    try {
      const result = await aiService.isMessageUrgent(message);
      const status = result.isUrgent ? '✅ URGENT' : '❌ NOT URGENT';
      const keywords = result.keywords.length > 0 ? ` (${result.keywords.join(', ')})` : '';
      console.log(`${status}: "${message}"${keywords}`);
    } catch (error) {
      console.error(`Error testing "${message}":`, error);
    }
  }

  console.log('\n=== Testing NON-URGENT messages ===');
  for (const message of nonUrgentMessages) {
    try {
      const result = await aiService.isMessageUrgent(message);
      const status = result.isUrgent ? '❌ URGENT (should be non-urgent)' : '✅ NOT URGENT';
      const keywords = result.keywords.length > 0 ? ` (${result.keywords.join(', ')})` : '';
      console.log(`${status}: "${message}"${keywords}`);
    } catch (error) {
      console.error(`Error testing "${message}":`, error);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Enhanced urgency detection now recognizes:');
  console.log('- Days of the week + meeting/occasion words');
  console.log('- Time patterns (2 PM, 10:30, at 3)');
  console.log('- Date patterns (15th, 3/15, next Tuesday)');
  console.log('- Scheduling inquiries (Can we meet, Are you free)');
  console.log('- Traditional urgent keywords');

  await app.close();
}

testUrgencyDetection()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AIChatService } from '../ai/ai-chat.service';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { getModelToken } from '@nestjs/mongoose';

async function testTarpAINoScheduling() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const aiChatService = app.get(AIChatService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  console.log('Testing TarpAI without scheduling functionality...');

  try {
    // Find a test user
    const user = await userModel.findOne().exec();
    
    if (!user) {
      console.log('No users found to test with');
      return;
    }

    console.log(`Testing with user: ${user.name} (${user._id})`);

    // Test 1: Ask about scheduling (should be declined)
    console.log('\n=== Test 1: Scheduling request (should be declined) ===');
    try {
      const response1 = await aiChatService.sendMessage(
        user._id.toString(),
        'Can you schedule a meeting for me tomorrow at 2 PM?'
      );
      console.log('AI Response:', response1.response);
    } catch (error) {
      console.error('Error:', error);
    }

    // Test 2: Ask about messaging features (should work)
    console.log('\n=== Test 2: Messaging question (should work) ===');
    try {
      const response2 = await aiChatService.sendMessage(
        user._id.toString(),
        'How do I send messages to other users on TarpAI?'
      );
      console.log('AI Response:', response2.response);
    } catch (error) {
      console.error('Error:', error);
    }

    // Test 3: Search for users (should work)
    console.log('\n=== Test 3: User search (should work) ===');
    try {
      const response3 = await aiChatService.sendMessage(
        user._id.toString(),
        'Can you help me find users named John?'
      );
      console.log('AI Response:', response3.response);
    } catch (error) {
      console.error('Error:', error);
    }

    // Test 4: Ask for code help (should be declined)
    console.log('\n=== Test 4: Code request (should be declined) ===');
    try {
      const response4 = await aiChatService.sendMessage(
        user._id.toString(),
        'Write a Python function to add two numbers'
      );
      console.log('AI Response:', response4.response);
    } catch (error) {
      console.error('Error:', error);
    }

    console.log('\n=== Test Complete ===');
    console.log('Expected behavior:');
    console.log('- Scheduling requests: Declined');
    console.log('- Messaging questions: Answered helpfully');
    console.log('- User search: Functional');
    console.log('- Code requests: Declined');
    console.log('- Focus: Messaging assistant for cross-platform communication');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await app.close();
  }
}

testTarpAINoScheduling()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ChatService } from '../chat/chat.service';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Conversation } from '../chat/conversation.schema';
import { getModelToken } from '@nestjs/mongoose';

async function testAutoReplyCooldown() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const chatService = app.get(ChatService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const conversationModel = app.get<Model<Conversation>>(getModelToken(Conversation.name));

  console.log('Testing auto-reply cooldown functionality...');

  try {
    // Find two test users
    const users = await userModel.find().limit(2).exec();
    
    if (users.length < 2) {
      console.log('Need at least 2 users to test. Creating test users...');
      // You would need to create test users here if needed
      return;
    }

    const user1 = users[0];
    const user2 = users[1];

    console.log(`Testing with users: ${user1.name} (${user1._id}) and ${user2.name} (${user2._id})`);

    // Create or get conversation
    const conversation = await chatService.createConversation(user1._id.toString(), user2._id.toString());
    const conversationId = conversation.id.toString();

    console.log(`Using conversation: ${conversationId}`);

    // Simulate user2 being inactive by setting lastAutoReplyAt to null (or old date)
    await conversationModel.findByIdAndUpdate(conversationId, {
      lastAutoReplyAt: null
    });

    console.log('\n=== Test 1: First auto-reply (should work) ===');
    
    // Send first message that should trigger auto-reply
    await chatService.sendMessage(
      conversationId,
      user1._id.toString(),
      'Hey there! How are you doing?',
      'text'
    );

    // Wait a moment for auto-reply processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if lastAutoReplyAt was updated
    const updatedConv1 = await conversationModel.findById(conversationId);
    console.log('Last auto-reply at:', updatedConv1?.lastAutoReplyAt);

    console.log('\n=== Test 2: Second auto-reply within 5 minutes (should be blocked) ===');
    
    // Send second message immediately (should be blocked by cooldown)
    await chatService.sendMessage(
      conversationId,
      user1._id.toString(),
      'Are you there? I need to talk to you.',
      'text'
    );

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n=== Test 3: Check cooldown status ===');
    
    const updatedConv2 = await conversationModel.findById(conversationId);
    if (updatedConv2?.lastAutoReplyAt) {
      const now = new Date();
      const timeSinceLastReply = now.getTime() - updatedConv2.lastAutoReplyAt.getTime();
      const timeUntilNextReply = Math.max(0, 5 * 60 * 1000 - timeSinceLastReply);
      
      console.log(`Time since last auto-reply: ${Math.round(timeSinceLastReply / 1000)} seconds`);
      console.log(`Time until next auto-reply allowed: ${Math.round(timeUntilNextReply / 1000)} seconds`);
    }

    console.log('\n=== Test 4: Simulate 5+ minutes later (should work) ===');
    
    // Set lastAutoReplyAt to 6 minutes ago to simulate time passing
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    await conversationModel.findByIdAndUpdate(conversationId, {
      lastAutoReplyAt: sixMinutesAgo
    });

    console.log('Simulated 6 minutes passing...');

    // Send third message (should trigger auto-reply)
    await chatService.sendMessage(
      conversationId,
      user1._id.toString(),
      'Hello again! This should get an auto-reply.',
      'text'
    );

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalConv = await conversationModel.findById(conversationId);
    console.log('Final last auto-reply at:', finalConv?.lastAutoReplyAt);

    console.log('\n=== Test Complete ===');
    console.log('Check the conversation messages to see if auto-replies were sent correctly.');
    console.log('Expected behavior:');
    console.log('- First message: Auto-reply sent');
    console.log('- Second message: Auto-reply blocked (cooldown)');
    console.log('- Third message: Auto-reply sent (cooldown expired)');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await app.close();
  }
}

testAutoReplyCooldown()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
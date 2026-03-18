import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ChatService } from '../chat/chat.service';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../users/user.schema';
import { Conversation } from '../chat/conversation.schema';

async function testAIMessages() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const chatService = app.get(ChatService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const conversationModel = app.get<Model<Conversation>>(getModelToken(Conversation.name));
  
  console.log('Testing AI message functionality...');
  
  try {
    // Find two users for testing
    const users = await userModel.find().limit(2);
    if (users.length < 2) {
      console.log('Need at least 2 users for testing');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    
    console.log(`Testing with users: ${user1.name} and ${user2.name}`);
    
    // Create a conversation
    const conversation = await chatService.createConversation(user1._id.toString(), user2._id.toString());
    console.log('Conversation created:', conversation.id);
    
    // Convert conversation ID to string for use in subsequent calls
    const conversationId = conversation.id.toString();
    
    // Send a regular message
    console.log('Sending regular message...');
    const regularMessage = await chatService.sendMessage(
      conversationId,
      user1._id.toString(),
      'Hello, this is a regular message',
      'text',
      undefined,
      undefined,
      false, // not urgent
      false  // not AI
    );
    console.log('Regular message sent:', regularMessage.id);
    
    // Send an AI message
    console.log('Sending AI message...');
    const aiMessage = await chatService.sendMessage(
      conversationId,
      user2._id.toString(),
      'Hi! This is an AI-generated auto-reply message 🤖',
      'text',
      undefined,
      undefined,
      false, // not urgent
      true   // AI message
    );
    console.log('AI message sent:', aiMessage.id);
    
    // Fetch messages to verify
    console.log('Fetching messages...');
    const messages = await chatService.getConversationMessages(conversationId, user1._id.toString());
    
    console.log('\nMessages in conversation:');
    messages.messages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.isAI ? '[AI]' : '[Human]'} ${msg.content}`);
    });
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await app.close();
  }
}

testAIMessages().catch(console.error);
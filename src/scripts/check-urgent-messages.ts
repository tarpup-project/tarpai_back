import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { UrgentMessage } from '../chat/urgent-message.schema';

async function checkUrgentMessages() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const urgentMessageModel = app.get<Model<UrgentMessage>>(getModelToken(UrgentMessage.name));
  
  console.log('Checking urgent messages in database...');
  
  // Get all urgent messages
  const allUrgentMessages = await urgentMessageModel.find({}).populate('sender', 'name email').populate('recipient', 'name email');
  
  console.log(`Total urgent messages found: ${allUrgentMessages.length}`);
  
  if (allUrgentMessages.length > 0) {
    console.log('\nUrgent messages details:');
    allUrgentMessages.forEach((msg, index) => {
      console.log(`\n--- Urgent Message ${index + 1} ---`);
      console.log(`ID: ${msg._id}`);
      console.log(`Conversation: ${msg.conversation}`);
      console.log(`Sender: ${(msg.sender as any)?.name || 'Unknown'} (${(msg.sender as any)?.email || 'No email'})`);
      console.log(`Recipient: ${(msg.recipient as any)?.name || 'Unknown'} (${(msg.recipient as any)?.email || 'No email'})`);
      console.log(`Content: ${msg.content.substring(0, 50)}...`);
      console.log(`Has been replied to: ${msg.hasBeenRepliedTo}`);
      console.log(`Is active: ${msg.isActive}`);
      console.log(`Created: ${msg.createdAt}`);
    });
  } else {
    console.log('No urgent messages found in database.');
  }
  
  // Check active urgent messages
  const activeUrgentMessages = await urgentMessageModel.find({
    hasBeenRepliedTo: false,
    isActive: true
  });
  
  console.log(`\nActive urgent messages (not replied to): ${activeUrgentMessages.length}`);
  
  await app.close();
}

checkUrgentMessages().catch(console.error);
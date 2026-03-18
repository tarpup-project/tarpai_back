import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { UrgentMessage } from '../chat/urgent-message.schema';
import { Conversation } from '../chat/conversation.schema';

async function fixUrgentMessageRecipients() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const urgentMessageModel = app.get<Model<UrgentMessage>>(getModelToken(UrgentMessage.name));
  const conversationModel = app.get<Model<Conversation>>(getModelToken(Conversation.name));
  
  console.log('Starting to fix urgent message recipients...');
  
  // Find all urgent messages without recipient field
  const urgentMessagesWithoutRecipient = await urgentMessageModel.find({
    $or: [
      { recipient: null },
      { recipient: { $exists: false } }
    ]
  }).populate('conversation');
  
  console.log(`Found ${urgentMessagesWithoutRecipient.length} urgent messages without recipient field`);
  
  for (const urgentMessage of urgentMessagesWithoutRecipient) {
    try {
      // Get the conversation
      const conversation = await conversationModel.findById(urgentMessage.conversation);
      
      if (conversation && conversation.participants.length === 2) {
        // Find the recipient (the participant who is not the sender)
        const recipientId = conversation.participants.find(p => p.toString() !== urgentMessage.sender.toString());
        
        if (recipientId) {
          // Update the urgent message with the recipient
          await urgentMessageModel.updateOne(
            { _id: urgentMessage._id },
            { recipient: recipientId }
          );
          
          console.log(`Updated urgent message ${urgentMessage._id} with recipient ${recipientId}`);
        } else {
          console.log(`Could not find recipient for urgent message ${urgentMessage._id}`);
        }
      } else {
        console.log(`Skipping urgent message ${urgentMessage._id} - not a direct conversation or conversation not found`);
      }
    } catch (error) {
      console.error(`Error updating urgent message ${urgentMessage._id}:`, error);
    }
  }
  
  console.log('Finished fixing urgent message recipients');
  await app.close();
}

fixUrgentMessageRecipients().catch(console.error);
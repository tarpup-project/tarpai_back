import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { Conversation } from '../chat/conversation.schema';
import { Message } from '../chat/message.schema';
import { getModelToken } from '@nestjs/mongoose';

async function cleanupDuplicateConversations() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const conversationModel = app.get<Model<Conversation>>(getModelToken(Conversation.name));
  const messageModel = app.get<Model<Message>>(getModelToken(Message.name));

  console.log('Starting duplicate conversation cleanup...');

  // Find all conversations grouped by participants
  const conversations = await conversationModel.find({ isActive: true }).exec();
  
  // Group conversations by participant pairs
  const participantGroups = new Map<string, any[]>();
  
  for (const conv of conversations) {
    if (conv.participants.length === 2 && !conv.isGroup) {
      // Create a consistent key for the participant pair
      const sortedParticipants = conv.participants
        .map(p => p.toString())
        .sort()
        .join('-');
      
      if (!participantGroups.has(sortedParticipants)) {
        participantGroups.set(sortedParticipants, []);
      }
      
      participantGroups.get(sortedParticipants)!.push(conv);
    }
  }

  console.log(`Found ${participantGroups.size} unique participant pairs`);

  let duplicatesFound = 0;
  let conversationsDeleted = 0;

  // Process each group
  for (const [participantKey, convs] of participantGroups) {
    if (convs.length > 1) {
      duplicatesFound++;
      console.log(`\n=== Duplicate conversations for participants: ${participantKey} ===`);
      console.log(`Found ${convs.length} conversations:`);
      
      // Get message counts for each conversation
      const conversationsWithMessages = [];
      
      for (const conv of convs) {
        const messageCount = await messageModel.countDocuments({
          conversation: conv._id,
          isDeleted: false,
        });
        
        conversationsWithMessages.push({
          conversation: conv,
          messageCount,
          lastActivity: conv.lastActivity,
        });
        
        console.log(`  - ${conv._id}: ${messageCount} messages, last activity: ${conv.lastActivity}`);
      }
      
      // Sort by message count (desc) then by last activity (desc)
      conversationsWithMessages.sort((a, b) => {
        if (a.messageCount !== b.messageCount) {
          return b.messageCount - a.messageCount; // More messages first
        }
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(); // More recent first
      });
      
      // Keep the first one (most messages or most recent), delete the rest
      const toKeep = conversationsWithMessages[0];
      const toDelete = conversationsWithMessages.slice(1);
      
      console.log(`  Keeping: ${toKeep.conversation._id} (${toKeep.messageCount} messages)`);
      
      for (const item of toDelete) {
        console.log(`  Deleting: ${item.conversation._id} (${item.messageCount} messages)`);
        
        // Delete the conversation
        await conversationModel.findByIdAndDelete(item.conversation._id);
        conversationsDeleted++;
        
        // If it had messages, we should move them to the kept conversation
        if (item.messageCount > 0) {
          console.log(`    Moving ${item.messageCount} messages to kept conversation`);
          await messageModel.updateMany(
            { conversation: item.conversation._id },
            { conversation: toKeep.conversation._id }
          );
        }
      }
    }
  }

  console.log(`\n=== Cleanup Summary ===`);
  console.log(`Duplicate groups found: ${duplicatesFound}`);
  console.log(`Conversations deleted: ${conversationsDeleted}`);
  
  await app.close();
}

cleanupDuplicateConversations()
  .then(() => {
    console.log('Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
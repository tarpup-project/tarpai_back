import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { UrgentMessage } from '../chat/urgent-message.schema';

async function resetUrgentMessage() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const urgentMessageModel = app.get<Model<UrgentMessage>>(getModelToken(UrgentMessage.name));
  
  console.log('Resetting urgent message for testing...');
  
  // Reset the urgent message from Ramzi Junior to Ship Nex
  const result = await urgentMessageModel.updateOne(
    {
      _id: '69b9f031d14e94df3d2c4e2f' // The ID from your debug output
    },
    {
      hasBeenRepliedTo: false
    }
  );
  
  console.log('Update result:', result);
  
  if (result.modifiedCount > 0) {
    console.log('✅ Urgent message reset successfully! Now Ship Nex can reply and Ramzi Junior should get notified.');
  } else {
    console.log('❌ No urgent message was updated. Check the ID.');
  }
  
  await app.close();
}

resetUrgentMessage().catch(console.error);
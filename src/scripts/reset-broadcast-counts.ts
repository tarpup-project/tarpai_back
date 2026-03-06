import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../users/user.schema';

async function resetBroadcastCounts() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    console.log('🔄 Starting broadcast count reset for all users...');

    // Reset all users' broadcast counts
    const result = await userModel.updateMany(
      {}, // Match all users
      {
        $set: {
          yearlyBroadcastCount: 0,
          broadcastPeriodStart: null,
        },
      }
    );

    console.log(`✅ Successfully reset broadcast counts for ${result.modifiedCount} users`);
    console.log(`📊 Total users checked: ${result.matchedCount}`);
  } catch (error) {
    console.error('❌ Error resetting broadcast counts:', error);
  } finally {
    await app.close();
  }
}

resetBroadcastCounts();

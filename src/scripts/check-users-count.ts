import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';

async function checkUsersCount() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the user model directly
    const userModel = app.get('UserModel') as Model<User>;
    
    const totalUsers = await userModel.countDocuments();
    const verifiedUsers = await userModel.countDocuments({ isVerified: true });
    
    console.log(`📊 Database Stats:`);
    console.log(`Total users: ${totalUsers}`);
    console.log(`Verified users: ${verifiedUsers}`);
    
    // Get a few sample users
    const sampleUsers = await userModel
      .find({ isVerified: true })
      .select('name displayName username email createdAt followers following')
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(`\n👥 Sample users:`);
    sampleUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.displayName || user.name} (@${user.username})`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Created: ${user.createdAt}`);
      console.log(`     Followers: ${user.followers?.length || 0}, Following: ${user.following?.length || 0}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await app.close();
  }
}

checkUsersCount();
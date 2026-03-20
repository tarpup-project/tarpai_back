import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { getModelToken } from '@nestjs/mongoose';

async function debugFollowers() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    console.log('🔍 Debugging followers/following data...');
    
    // Get a few users to check their followers/following arrays
    const users = await userModel
      .find({ isVerified: true })
      .select('_id name username email followers following')
      .limit(5);

    console.log(`📊 Checking ${users.length} users:`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name} (@${user.username})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Followers array:`, user.followers);
      console.log(`   Followers count: ${user.followers?.length || 0}`);
      console.log(`   Following array:`, user.following);
      console.log(`   Following count: ${user.following?.length || 0}`);
    });

    // Check if there are any follow relationships at all
    const usersWithFollowers = await userModel.countDocuments({
      followers: { $exists: true, $not: { $size: 0 } }
    });
    
    const usersWithFollowing = await userModel.countDocuments({
      following: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`\n📈 Summary:`);
    console.log(`   Users with followers: ${usersWithFollowers}`);
    console.log(`   Users with following: ${usersWithFollowing}`);

    // Check if there's a separate follows collection
    const collections = await app.get('DatabaseConnection').db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log(`\n📚 Available collections:`, collectionNames);

    if (collectionNames.includes('follows')) {
      const followsCollection = app.get('DatabaseConnection').db.collection('follows');
      const followsCount = await followsCollection.countDocuments();
      console.log(`   Follows collection has ${followsCount} documents`);
      
      if (followsCount > 0) {
        const sampleFollows = await followsCollection.find().limit(3).toArray();
        console.log(`   Sample follows:`, sampleFollows);
      }
    }

  } catch (error) {
    console.error('❌ Error debugging followers:', error);
  } finally {
    await app.close();
  }
}

debugFollowers();
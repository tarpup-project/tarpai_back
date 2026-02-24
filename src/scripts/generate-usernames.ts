import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';

async function generateUsernames() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // Find all users without usernames
    const usersWithoutUsername = await userModel.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    });

    console.log(`Found ${usersWithoutUsername.length} users without usernames`);

    for (const user of usersWithoutUsername) {
      // Generate base username from name
      let baseUsername = user.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15);

      if (!baseUsername) {
        baseUsername = 'user';
      }

      // Try the base username first
      let username = baseUsername;
      let exists = await userModel.findOne({ username });
      
      // If exists, append random numbers until we find a unique one
      let counter = 1;
      while (exists) {
        const randomNum = Math.floor(Math.random() * 9999);
        username = `${baseUsername}${randomNum}`;
        exists = await userModel.findOne({ username });
        counter++;
        
        // Safety check
        if (counter > 100) {
          username = `${baseUsername}${Date.now()}`;
          break;
        }
      }

      // Update user with new username
      user.username = username;
      await user.save();
      console.log(`Generated username "${username}" for user: ${user.name} (${user.email})`);
    }

    console.log('Username generation completed!');
  } catch (error) {
    console.error('Error generating usernames:', error);
  } finally {
    await app.close();
  }
}

generateUsernames();

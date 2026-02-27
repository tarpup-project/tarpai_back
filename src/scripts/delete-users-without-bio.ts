import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';

async function deleteUsersWithoutBio() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    console.log('Starting deletion of users without bio...');

    // Find users without bio (null, undefined, or empty string)
    const usersToDelete = await userModel.find({
      $or: [
        { bio: { $exists: false } },
        { bio: null },
        { bio: '' }
      ]
    });

    console.log(`Found ${usersToDelete.length} users without bio`);

    if (usersToDelete.length === 0) {
      console.log('No users to delete');
      await app.close();
      return;
    }

    // Display users that will be deleted
    console.log('\nUsers to be deleted:');
    usersToDelete.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Username: ${user.username}`);
    });

    // Delete users
    const result = await userModel.deleteMany({
      $or: [
        { bio: { $exists: false } },
        { bio: null },
        { bio: '' }
      ]
    });

    console.log(`\n✅ Successfully deleted ${result.deletedCount} users without bio`);
  } catch (error) {
    console.error('❌ Error deleting users:', error);
  } finally {
    await app.close();
  }
}

deleteUsersWithoutBio();

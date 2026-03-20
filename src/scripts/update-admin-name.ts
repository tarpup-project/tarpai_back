import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { getModelToken } from '@nestjs/mongoose';

async function updateAdminName() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    console.log('🔍 Looking for admin user...');
    
    const adminEmail = 'travorproject@gmail.com';
    const adminUser = await userModel.findOne({ email: adminEmail });

    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log('📋 Current admin user details:');
    console.log(`ID: ${adminUser._id}`);
    console.log(`Name: ${adminUser.name}`);
    console.log(`Email: ${adminUser.email}`);
    console.log(`Username: ${adminUser.username}`);
    console.log(`Display Name: ${adminUser.displayName}`);

    // Update the name to "Admin"
    const result = await userModel.updateOne(
      { email: adminEmail },
      { 
        $set: { 
          name: 'Admin',
          displayName: 'Admin'
        } 
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Admin user name updated successfully!');
      
      // Verify the update
      const updatedUser = await userModel.findOne({ email: adminEmail });
      console.log('📋 Updated admin user details:');
      console.log(`Name: ${updatedUser.name}`);
      console.log(`Display Name: ${updatedUser.displayName}`);
    } else {
      console.log('⚠️ No changes made to admin user');
    }

  } catch (error) {
    console.error('❌ Error updating admin name:', error);
  } finally {
    await app.close();
  }
}

updateAdminName();
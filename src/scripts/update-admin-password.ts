import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

async function updateAdminPassword() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const adminEmail = 'travorproject@gmail.com';
  const adminPassword = 'winco23456';

  try {
    // Find the user
    const user = await userModel.findOne({ email: adminEmail });
    
    if (!user) {
      console.log('❌ User not found with email:', adminEmail);
      await app.close();
      return;
    }

    console.log('✅ User found, updating password...');
    console.log('Current name:', user.name);
    console.log('Current username:', user.username);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Update the user's password and ensure they're verified
    await userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      isVerified: true,
    });

    console.log('✅ Password updated successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    
    // Verify the password works
    const updatedUser = await userModel.findOne({ email: adminEmail });
    const isPasswordValid = await bcrypt.compare(adminPassword, updatedUser.password);
    console.log('Password verification:', isPasswordValid ? '✅ Valid' : '❌ Invalid');
    
  } catch (error) {
    console.error('❌ Error updating admin password:', error);
  } finally {
    await app.close();
  }
}

updateAdminPassword();
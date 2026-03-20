import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

async function checkAdminUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const adminEmail = 'travorproject@gmail.com';
  const adminPassword = 'winco23456';

  try {
    // Find admin user
    const adminUser = await userModel.findOne({ email: adminEmail });
    
    if (!adminUser) {
      console.log('❌ Admin user not found with email:', adminEmail);
      await app.close();
      return;
    }

    console.log('✅ Admin user found!');
    console.log('ID:', adminUser._id);
    console.log('Name:', adminUser.name);
    console.log('Email:', adminUser.email);
    console.log('Username:', adminUser.username);
    console.log('Is Verified:', adminUser.isVerified);
    console.log('Has Password:', !!adminUser.password);
    
    // Test password
    if (adminUser.password) {
      const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password);
      console.log('Password Valid:', isPasswordValid);
    } else {
      console.log('❌ No password set for admin user');
    }
    
  } catch (error) {
    console.error('❌ Error checking admin user:', error);
  } finally {
    await app.close();
  }
}

checkAdminUser();
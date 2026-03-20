import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminService } from '../admin/admin.service';

async function testUserData() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminService = app.get(AdminService);

  try {
    console.log('🔍 Testing user data retrieval...');
    
    const users = await adminService.getAllUsers();
    
    console.log(`📊 Found ${users.length} users`);
    
    // Show first 3 users as examples
    users.slice(0, 3).forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.displayName || user.name} (@${user.username})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Followers: ${user.followersCount}`);
      console.log(`   Following: ${user.followingCount}`);
      console.log(`   Yearly Broadcasts: ${user.yearlyBroadcastCount}/2`);
      console.log(`   Total Broadcasts: ${user.actualBroadcastCount}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}`);
    });

    // Show summary stats
    const totalFollowers = users.reduce((sum, user) => sum + user.followersCount, 0);
    const totalFollowing = users.reduce((sum, user) => sum + user.followingCount, 0);
    const totalBroadcasts = users.reduce((sum, user) => sum + user.actualBroadcastCount, 0);
    const usersWithBroadcasts = users.filter(user => user.actualBroadcastCount > 0).length;

    console.log('\n📈 Summary Statistics:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Total Followers: ${totalFollowers}`);
    console.log(`   Total Following: ${totalFollowing}`);
    console.log(`   Total Broadcasts: ${totalBroadcasts}`);
    console.log(`   Users with Broadcasts: ${usersWithBroadcasts}`);

  } catch (error) {
    console.error('❌ Error testing user data:', error);
  } finally {
    await app.close();
  }
}

testUserData();
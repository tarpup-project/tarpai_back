import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminService } from '../admin/admin.service';

async function testRecentSignups() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminService = app.get(AdminService);

  try {
    console.log('🔍 Testing recent signups functionality...');
    
    const recentSignups = await adminService.getRecentSignups();
    
    console.log('📊 Recent Signups Results:');
    console.log(`Total recent signups (last 10 days): ${recentSignups.totalRecentSignups}`);
    console.log(`Daily breakdown:`);
    
    recentSignups.dailySignups.forEach(day => {
      console.log(`  ${day.date}: ${day.count} signups`);
      if (day.users.length > 0) {
        console.log(`    Users: ${day.users.map(u => `${u.displayName || u.name} (@${u.username})`).join(', ')}`);
      }
    });
    
    console.log(`\n📝 Recent users (${recentSignups.recentUsers.length}):`);
    recentSignups.recentUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.displayName || user.name} (@${user.username}) - ${new Date(user.createdAt).toLocaleDateString()}`);
    });
    
    console.log('\n✅ Recent signups test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing recent signups:', error);
  } finally {
    await app.close();
  }
}

testRecentSignups();
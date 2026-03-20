import { createConnection, Connection } from 'mongoose';

// Database connection
const DB_URL = process.env.MONGODB_URI || 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

interface UserToDelete {
  _id: any;
  name: string;
  email: string;
  username?: string;
  createdAt: Date;
  [key: string]: any;
}

async function deleteRecentUsers() {
  let connection: Connection | null = null;

  try {
    console.log('🔌 Connecting to database...');
    connection = createConnection(DB_URL);
    await connection.asPromise();
    console.log('✅ Connected to database');

    const usersCollection = connection.collection('users');
    const conversationsCollection = connection.collection('conversations');
    const messagesCollection = connection.collection('messages');
    const followsCollection = connection.collection('follows');
    const statusesCollection = connection.collection('statuses');
    const linksCollection = connection.collection('links');
    const notificationsCollection = connection.collection('notifications');

    // Calculate the cutoff time (3 hours ago)
    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);
    
    console.log(`🕐 Cutoff time: ${threeHoursAgo.toISOString()}`);
    console.log(`🔍 Looking for users created after: ${threeHoursAgo.toLocaleString()}`);

    // Find users created in the past 3 hours
    console.log('📥 Fetching recent users...');
    const recentUsers = await usersCollection.find({
      createdAt: { $gte: threeHoursAgo }
    }).toArray() as unknown as UserToDelete[];

    console.log(`📊 Found ${recentUsers.length} users created in the past 3 hours`);

    if (recentUsers.length === 0) {
      console.log('✅ No recent users to delete');
      return;
    }

    // Show users that will be deleted
    console.log('\n👥 Users to be deleted:');
    recentUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Created: ${new Date(user.createdAt).toLocaleString()}`);
    });

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete these users and all their data!');
    console.log('⚠️  This includes: messages, conversations, follows, statuses, links, and notifications');
    
    // In a real script, you might want to add a confirmation prompt
    // For now, we'll add a safety check
    const CONFIRM_DELETE = process.env.CONFIRM_DELETE === 'true';
    
    if (!CONFIRM_DELETE) {
      console.log('\n❌ Deletion cancelled. To confirm deletion, set CONFIRM_DELETE=true environment variable');
      console.log('Example: CONFIRM_DELETE=true npm run script:delete-recent-users');
      return;
    }

    console.log('\n🗑️  Starting deletion process...');

    let deletedCount = 0;
    let errorCount = 0;
    const userIds = recentUsers.map(user => user._id);

    for (const user of recentUsers) {
      try {
        console.log(`🗑️  Deleting user: ${user.name} (${user.email})`);

        // Delete user's conversations (as participant)
        const conversationsToDelete = await conversationsCollection.find({
          participants: user._id
        }).toArray();

        for (const conversation of conversationsToDelete) {
          // Delete messages in this conversation
          const messageDeleteResult = await messagesCollection.deleteMany({
            conversation: conversation._id
          });
          console.log(`  📧 Deleted ${messageDeleteResult.deletedCount} messages from conversation ${conversation._id}`);
        }

        // Delete conversations where user is a participant
        const conversationDeleteResult = await conversationsCollection.deleteMany({
          participants: user._id
        });
        console.log(`  💬 Deleted ${conversationDeleteResult.deletedCount} conversations`);

        // Delete user's messages (in case any are left)
        const userMessageDeleteResult = await messagesCollection.deleteMany({
          sender: user._id
        });
        console.log(`  📨 Deleted ${userMessageDeleteResult.deletedCount} user messages`);

        // Delete follows (both following and followers)
        const followDeleteResult = await followsCollection.deleteMany({
          $or: [
            { follower: user._id },
            { following: user._id }
          ]
        });
        console.log(`  👥 Deleted ${followDeleteResult.deletedCount} follow relationships`);

        // Delete user's statuses
        const statusDeleteResult = await statusesCollection.deleteMany({
          user: user._id
        });
        console.log(`  📱 Deleted ${statusDeleteResult.deletedCount} statuses`);

        // Delete user's links
        const linkDeleteResult = await linksCollection.deleteMany({
          user: user._id
        });
        console.log(`  🔗 Deleted ${linkDeleteResult.deletedCount} links`);

        // Delete notifications for/from this user
        const notificationDeleteResult = await notificationsCollection.deleteMany({
          $or: [
            { user: user._id },
            { sender: user._id }
          ]
        });
        console.log(`  🔔 Deleted ${notificationDeleteResult.deletedCount} notifications`);

        // Finally, delete the user
        await usersCollection.deleteOne({ _id: user._id });
        console.log(`  ✅ Deleted user: ${user.name}`);

        deletedCount++;

      } catch (error: any) {
        console.error(`❌ Error deleting user ${user.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Deletion Summary:');
    console.log(`✅ Successfully deleted: ${deletedCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${recentUsers.length}`);

    if (deletedCount > 0) {
      console.log('\n🧹 Cleanup completed successfully!');
    }

  } catch (error) {
    console.error('❌ Deletion failed:', error);
    throw error;
  } finally {
    // Close connection
    if (connection) {
      await connection.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run deletion script
console.log('🚀 Starting recent users deletion...\n');
console.log('⏰ This will delete users created in the past 3 hours');
console.log('🗑️  Along with all their associated data (messages, follows, statuses, etc.)\n');

deleteRecentUsers()
  .then(() => {
    console.log('\n✅ Deletion script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deletion script failed:', error);
    process.exit(1);
  });
import { createConnection, Connection } from 'mongoose';

// Database connection
const DB_URL = process.env.MONGODB_URI || 'mongodb+srv://tarpai:Jumong25@henrycluster.cimmklx.mongodb.net/nestjs_db?retryWrites=true&w=majority';

interface UserToDelete {
  _id: any;
  name: string;
  email: string;
  username?: string;
  createdAt: Date;
  [key: string]: any;
}

// List of usernames to delete - MODIFY THIS ARRAY
const USERNAMES_TO_DELETE = [
  // Add usernames here, for example:
  'tetranix',
];

async function deleteUsersByUsername() {
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

    if (USERNAMES_TO_DELETE.length === 0) {
      console.log('❌ No usernames specified for deletion');
      console.log('📝 Please edit the USERNAMES_TO_DELETE array in the script');
      return;
    }

    console.log(`🔍 Looking for users with usernames: ${USERNAMES_TO_DELETE.join(', ')}`);

    // Find users by username
    console.log('📥 Fetching users by username...');
    const usersToDelete = await usersCollection.find({
      username: { $in: USERNAMES_TO_DELETE }
    }).toArray() as unknown as UserToDelete[];

    console.log(`📊 Found ${usersToDelete.length} users matching the specified usernames`);

    if (usersToDelete.length === 0) {
      console.log('✅ No users found with the specified usernames');
      return;
    }

    // Show users that will be deleted
    console.log('\n👥 Users to be deleted:');
    usersToDelete.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (@${user.username}) - ${user.email} - Created: ${new Date(user.createdAt).toLocaleString()}`);
    });

    // Check for usernames that weren't found
    const foundUsernames = usersToDelete.map(user => user.username);
    const notFoundUsernames = USERNAMES_TO_DELETE.filter(username => !foundUsernames.includes(username));
    
    if (notFoundUsernames.length > 0) {
      console.log('\n⚠️  Usernames not found:');
      notFoundUsernames.forEach(username => {
        console.log(`   - @${username}`);
      });
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete these users and all their data!');
    console.log('⚠️  This includes: messages, conversations, follows, statuses, links, and notifications');
    
    // Safety check
    const CONFIRM_DELETE = process.env.CONFIRM_DELETE === 'true';
    
    if (!CONFIRM_DELETE) {
      console.log('\n❌ Deletion cancelled. To confirm deletion, set CONFIRM_DELETE=true environment variable');
      console.log('Example: CONFIRM_DELETE=true npm run script:delete-users-by-username');
      return;
    }

    console.log('\n🗑️  Starting deletion process...');

    let deletedCount = 0;
    let errorCount = 0;

    for (const user of usersToDelete) {
      try {
        console.log(`🗑️  Deleting user: ${user.name} (@${user.username}) - ${user.email}`);

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
        console.log(`  ✅ Deleted user: ${user.name} (@${user.username})`);

        deletedCount++;

      } catch (error: any) {
        console.error(`❌ Error deleting user @${user.username}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Deletion Summary:');
    console.log(`✅ Successfully deleted: ${deletedCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${usersToDelete.length}`);
    console.log(`🔍 Usernames not found: ${notFoundUsernames.length}`);

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
console.log('🚀 Starting username-based user deletion...\n');
console.log('🗑️  This will delete specified users and all their associated data\n');

deleteUsersByUsername()
  .then(() => {
    console.log('\n✅ Deletion script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deletion script failed:', error);
    process.exit(1);
  });
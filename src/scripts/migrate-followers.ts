import { createConnection, Connection } from 'mongoose';

// Source database (old)
const SOURCE_DB = 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

// Target database (current)
const TARGET_DB = 'mongodb+srv://tarpai:Jumong25@henrycluster.cimmklx.mongodb.net/nestjs_db?retryWrites=true&w=majority';

interface OldUser {
  _id: any;
  email: string;
  [key: string]: any;
}

interface OldSocialProfileFollowing {
  _id: any;
  ownerID: any; // The user who is being followed
  followerID: any; // The user who is following
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

async function migrateFollowers() {
  let sourceConnection: Connection | null = null;
  let targetConnection: Connection | null = null;

  try {
    console.log('🔌 Connecting to source database...');
    sourceConnection = createConnection(SOURCE_DB);
    await sourceConnection.asPromise();
    console.log('✅ Connected to source database');

    console.log('🔌 Connecting to target database...');
    targetConnection = createConnection(TARGET_DB);
    await targetConnection.asPromise();
    console.log('✅ Connected to target database');

    const sourceUsersCollection = sourceConnection.collection('users');
    const targetUsersCollection = targetConnection.collection('users');
    const sourceSocialProfileFollowingCollection = sourceConnection.collection('SocialProfileFollowing');

    // First, build a mapping of old user IDs to new user IDs based on email
    console.log('\n📥 Building user ID mapping...');
    const oldUsers = await sourceUsersCollection.find({}).toArray() as unknown as OldUser[];
    const newUsers = await targetUsersCollection.find({}).toArray() as unknown as OldUser[];

    const userIdMap = new Map<string, any>(); // old ID -> new ID
    
    for (const oldUser of oldUsers) {
      const newUser = newUsers.find(u => u.email === oldUser.email);
      if (newUser) {
        userIdMap.set(oldUser._id.toString(), newUser._id);
      }
    }

    console.log(`✅ Mapped ${userIdMap.size} users`);

    // Fetch follower/following relationships
    console.log('\n📥 Fetching follower/following relationships from source database...');
    const oldFollowRelationships = await sourceSocialProfileFollowingCollection.find({}).toArray() as unknown as OldSocialProfileFollowing[];
    console.log(`📊 Found ${oldFollowRelationships.length} follow relationships to migrate`);

    let followSuccessCount = 0;
    let followErrorCount = 0;

    // Build followers and following maps
    const followersMap = new Map<string, Set<any>>(); // newOwnerId -> Set of newFollowerIds
    const followingMap = new Map<string, Set<any>>(); // newFollowerId -> Set of newOwnerIds

    for (const relationship of oldFollowRelationships) {
      const oldOwnerIdStr = relationship.ownerID?.toString();
      const oldFollowerIdStr = relationship.followerID?.toString();

      const newOwnerId = userIdMap.get(oldOwnerIdStr);
      const newFollowerId = userIdMap.get(oldFollowerIdStr);

      if (!newOwnerId || !newFollowerId) {
        console.log(`⏭️  Skipping relationship: owner ${oldOwnerIdStr} -> follower ${oldFollowerIdStr} (user not found)`);
        followErrorCount++;
        continue;
      }

      // Add to followers map (owner's followers)
      if (!followersMap.has(newOwnerId.toString())) {
        followersMap.set(newOwnerId.toString(), new Set());
      }
      followersMap.get(newOwnerId.toString())!.add(newFollowerId);

      // Add to following map (follower's following)
      if (!followingMap.has(newFollowerId.toString())) {
        followingMap.set(newFollowerId.toString(), new Set());
      }
      followingMap.get(newFollowerId.toString())!.add(newOwnerId);
    }

    // Update all users with their followers and following
    console.log('\n📝 Updating users with followers and following...');
    for (const newUser of newUsers) {
      try {
        const userId = newUser._id.toString();
        const followers = Array.from(followersMap.get(userId) || []);
        const following = Array.from(followingMap.get(userId) || []);

        await targetUsersCollection.updateOne(
          { _id: newUser._id },
          { 
            $set: { 
              followers: followers,
              following: following
            } 
          }
        );

        if (followers.length > 0 || following.length > 0) {
          console.log(`✅ Updated ${newUser.email}: ${followers.length} followers, ${following.length} following`);
        }
        followSuccessCount++;

      } catch (error: any) {
        console.error(`❌ Error updating follow relationships for user ${newUser.email}:`, error.message);
        followErrorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully updated: ${followSuccessCount} users with follow relationships`);
    console.log(`❌ Errors: ${followErrorCount}`);
    console.log(`📈 Total relationships processed: ${oldFollowRelationships.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (sourceConnection) {
      await sourceConnection.close();
      console.log('🔌 Source database connection closed');
    }
    if (targetConnection) {
      await targetConnection.close();
      console.log('🔌 Target database connection closed');
    }
  }
}

// Run migration
console.log('🚀 Starting follower/following migration...\n');
migrateFollowers()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

import { createConnection, Connection } from 'mongoose';

// Source database (old) - Updated to use 'project' database
const SOURCE_DB = 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

// Target database (current)
const TARGET_DB = 'mongodb+srv://tarpai:Jumong25@henrycluster.cimmklx.mongodb.net/nestjs_db?retryWrites=true&w=majority';

interface OldUser {
  _id: any;
  name: string;
  email: string;
  password?: string;
  username?: string;
  imgUrl?: string; // Old field name
  bgUrl?: string;
  isVerified?: boolean;
  gender?: string;
  phoneNumber?: string;
  countryCode?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  interests?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  updateAt?: Date; // Note: typo in old schema
  [key: string]: any;
}

interface OldSocialMedia {
  _id: any;
  url: string;
  ownerID: any; // Reference to user
  title?: string;
  description?: string;
  image?: string;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
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

interface NewUser {
  name: string;
  email: string;
  password?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  avatar?: string; // New field name (from imgUrl)
  isVerified: boolean;
  followers: any[];
  following: any[];
  isSilentSignup: boolean;
  lastActiveAt: Date;
  yearlyBroadcastCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NewLink {
  userId: any; // Reference to user
  title: string;
  url: string;
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

async function replaceUsers() {
  let sourceConnection: Connection | null = null;
  let targetConnection: Connection | null = null;

  try {
    console.log('🚨 WARNING: This will DELETE ALL existing users in the target database!');
    console.log('⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n');
    
    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔌 Connecting to source database...');
    sourceConnection = createConnection(SOURCE_DB);
    await sourceConnection.asPromise();
    console.log('✅ Connected to source database');

    console.log('🔌 Connecting to target database...');
    targetConnection = createConnection(TARGET_DB);
    await targetConnection.asPromise();
    console.log('✅ Connected to target database');

    // Get collections - Try different possible collection names
    console.log('🔍 Checking available collections in source database...');
    const collections = await sourceConnection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name).join(', '));
    
    // Try to find the users collection
    let sourceUsersCollection;
    const possibleNames = ['users', 'project.users', 'project/users', 'User', 'user'];
    
    for (const name of possibleNames) {
      const testCollection = sourceConnection.collection(name);
      const count = await testCollection.countDocuments();
      if (count > 0) {
        console.log(`✅ Found ${count} users in collection: ${name}`);
        sourceUsersCollection = testCollection;
        break;
      }
    }
    
    if (!sourceUsersCollection) {
      console.log('❌ Could not find users collection. Please check the collection name.');
      console.log('Available collections:', collections.map(c => c.name).join(', '));
      return;
    }
    
    const targetUsersCollection = targetConnection.collection('users');
    const targetLinksCollection = targetConnection.collection('links');

    // DELETE ALL EXISTING USERS IN TARGET DATABASE
    console.log('\n🗑️  Deleting all existing users in target database...');
    const deleteUsersResult = await targetUsersCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteUsersResult.deletedCount} existing users`);

    // DELETE ALL EXISTING LINKS IN TARGET DATABASE
    console.log('🗑️  Deleting all existing links in target database...');
    const deleteLinksResult = await targetLinksCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteLinksResult.deletedCount} existing links`);

    // Fetch all users from source
    console.log('\n📥 Fetching users from source database...');
    const oldUsers = await sourceUsersCollection.find({}).toArray() as unknown as OldUser[];
    console.log(`📊 Found ${oldUsers.length} users to migrate`);

    if (oldUsers.length === 0) {
      console.log('⚠️  No users found in source database');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const usernameMap = new Map<string, number>(); // Track username usage
    const userIdMap = new Map<string, any>(); // Map old user IDs to new user IDs

    // Migrate each user
    for (const oldUser of oldUsers) {
      try {
        // Ensure username exists and is unique
        let username = oldUser.username;
        if (!username) {
          // Generate from email or name
          const baseUsername = (oldUser.email.split('@')[0] || oldUser.name)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          
          username = baseUsername;
        }

        // Make username unique
        const baseUsername = username;
        let counter = usernameMap.get(baseUsername) || 0;
        if (counter > 0) {
          username = `${baseUsername}${counter}`;
        }
        usernameMap.set(baseUsername, counter + 1);

        // Prepare new user data with field mapping
        const newUser: NewUser = {
          name: oldUser.name,
          email: oldUser.email,
          password: oldUser.password, // Keep existing hashed password
          username: username,
          displayName: oldUser.name,
          bio: '', // Old schema doesn't have bio
          avatar: oldUser.imgUrl || 'https://res.cloudinary.com/dhjzwncjf/image/upload/v1771255225/Screenshot_2026-02-16_at_4.20.04_pm_paes1n.png', // Map imgUrl to avatar
          isVerified: oldUser.isVerified !== undefined ? oldUser.isVerified : true, // Default to true if not specified
          followers: [], // Old schema doesn't have followers
          following: [], // Old schema doesn't have following
          isSilentSignup: false,
          lastActiveAt: new Date(),
          yearlyBroadcastCount: 0,
          createdAt: oldUser.createdAt || new Date(),
          updatedAt: oldUser.updatedAt || oldUser.updateAt || new Date(), // Handle typo in old schema
        };

        // Insert into target database
        const insertResult = await targetUsersCollection.insertOne(newUser as any);
        
        // Map old user ID to new user ID
        userIdMap.set(oldUser._id.toString(), insertResult.insertedId);
        
        console.log(`✅ Migrated: ${oldUser.email} (username: ${username})`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Error migrating ${oldUser.email}:`, error.message);
        errorCount++;
      }
    }

    // Now migrate SocialMedias to Links
    console.log('\n📥 Fetching social media links from source database...');
    const sourceSocialMediasCollection = sourceConnection.collection('SocialMedias');
    const oldSocialMedias = await sourceSocialMediasCollection.find({}).toArray() as unknown as OldSocialMedia[];
    console.log(`📊 Found ${oldSocialMedias.length} social media links to migrate`);

    let linksSuccessCount = 0;
    let linksErrorCount = 0;

    for (const oldSocialMedia of oldSocialMedias) {
      try {
        // Get the new user ID from the mapping
        const oldOwnerIdStr = oldSocialMedia.ownerID?.toString();
        const newUserId = userIdMap.get(oldOwnerIdStr);

        if (!newUserId) {
          console.log(`⏭️  Skipping link for non-existent user: ${oldOwnerIdStr}`);
          linksErrorCount++;
          continue;
        }

        // Prepare new link data
        const newLink: NewLink = {
          userId: newUserId,
          title: oldSocialMedia.title || 'Social Link',
          url: oldSocialMedia.url,
          order: oldSocialMedia.order || 0,
          isActive: true,
          createdAt: oldSocialMedia.createdAt || new Date(),
          updatedAt: oldSocialMedia.updatedAt || new Date(),
        };

        // Insert into target database
        await targetLinksCollection.insertOne(newLink as any);
        console.log(`✅ Migrated link: ${newLink.title} for user ${newUserId}`);
        linksSuccessCount++;

      } catch (error: any) {
        console.error(`❌ Error migrating link:`, error.message);
        linksErrorCount++;
      }
    }

    // Now migrate SocialProfileFollowing to update followers/following arrays
    console.log('\n� Fetching follower/following relationships from source database...');
    const sourceSocialProfileFollowingCollection = sourceConnection.collection('SocialProfileFollowing');
    const oldFollowRelationships = await sourceSocialProfileFollowingCollection.find({}).toArray() as unknown as OldSocialProfileFollowing[];
    console.log(`📊 Found ${oldFollowRelationships.length} follow relationships to migrate`);

    let followSuccessCount = 0;
    let followErrorCount = 0;

    // Build followers and following maps
    const followersMap = new Map<string, Set<any>>(); // ownerID -> Set of followerIDs
    const followingMap = new Map<string, Set<any>>(); // followerID -> Set of ownerIDs

    for (const relationship of oldFollowRelationships) {
      const oldOwnerIdStr = relationship.ownerID?.toString();
      const oldFollowerIdStr = relationship.followerID?.toString();

      const newOwnerId = userIdMap.get(oldOwnerIdStr);
      const newFollowerId = userIdMap.get(oldFollowerIdStr);

      if (!newOwnerId || !newFollowerId) {
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
    for (const [userIdStr, newUserId] of userIdMap.entries()) {
      try {
        const followers = Array.from(followersMap.get(newUserId.toString()) || []);
        const following = Array.from(followingMap.get(newUserId.toString()) || []);

        await targetUsersCollection.updateOne(
          { _id: newUserId },
          { 
            $set: { 
              followers: followers,
              following: following
            } 
          }
        );

        if (followers.length > 0 || following.length > 0) {
          console.log(`✅ Updated user ${newUserId}: ${followers.length} followers, ${following.length} following`);
        }
        followSuccessCount++;

      } catch (error: any) {
        console.error(`❌ Error updating follow relationships for user ${newUserId}:`, error.message);
        followErrorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`🗑️  Deleted from target: ${deleteUsersResult.deletedCount} users, ${deleteLinksResult.deletedCount} links`);
    console.log(`✅ Successfully migrated: ${successCount} users, ${linksSuccessCount} links, ${followSuccessCount} follow relationships`);
    console.log(`❌ Errors: ${errorCount} users, ${linksErrorCount} links, ${followErrorCount} follow relationships`);
    console.log(`📈 Total processed: ${oldUsers.length} users, ${oldSocialMedias.length} links, ${oldFollowRelationships.length} follow relationships`);

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
console.log('🚀 Starting REPLACE users migration...\n');
replaceUsers()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

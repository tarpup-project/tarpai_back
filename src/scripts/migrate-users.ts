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

async function migrateUsers() {
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

    // Fetch all users from source
    console.log('📥 Fetching users from source database...');
    const oldUsers = await sourceUsersCollection.find({}).toArray() as unknown as OldUser[];
    console.log(`📊 Found ${oldUsers.length} users to migrate`);

    if (oldUsers.length === 0) {
      console.log('⚠️  No users found in source database');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Migrate each user
    for (const oldUser of oldUsers) {
      try {
        // Check if user already exists in target database
        const existingUser = await targetUsersCollection.findOne({ 
          email: oldUser.email 
        });

        if (existingUser) {
          console.log(`⏭️  Skipping ${oldUser.email} - already exists`);
          skipCount++;
          continue;
        }

        // Ensure username exists and is unique
        let username = oldUser.username;
        if (!username) {
          // Generate from email or name
          const baseUsername = (oldUser.email.split('@')[0] || oldUser.name)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          
          // Check if username exists and make it unique
          let counter = 1;
          username = baseUsername;
          while (await targetUsersCollection.findOne({ username })) {
            username = `${baseUsername}${counter}`;
            counter++;
          }
        } else {
          // Check if username already exists in target
          const existingUsername = await targetUsersCollection.findOne({ username });
          if (existingUsername) {
            let counter = 1;
            const baseUsername = username;
            while (await targetUsersCollection.findOne({ username })) {
              username = `${baseUsername}${counter}`;
              counter++;
            }
          }
        }

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
        await targetUsersCollection.insertOne(newUser as any);
        console.log(`✅ Migrated: ${oldUser.email} (username: ${username})`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Error migrating ${oldUser.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${oldUsers.length}`);

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
console.log('🚀 Starting user migration...\n');
migrateUsers()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

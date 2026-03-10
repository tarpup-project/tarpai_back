import { createConnection, Connection } from 'mongoose';

// Source database (old)
const SOURCE_DB = 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

// Target database (current)
const TARGET_DB = 'mongodb+srv://tarpai:Jumong25@henrycluster.cimmklx.mongodb.net/nestjs_db?retryWrites=true&w=majority';

interface OldUser {
  _id: any;
  email: string;
  bio?: string;
  [key: string]: any;
}

interface NewUser {
  _id: any;
  email: string;
  bio?: string;
  [key: string]: any;
}

async function migrateBios() {
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

    // Get all users from both databases
    console.log('\n📥 Fetching users from both databases...');
    const oldUsers = await sourceUsersCollection.find({}).toArray() as unknown as OldUser[];
    const newUsers = await targetUsersCollection.find({}).toArray() as unknown as NewUser[];

    console.log(`📊 Found ${oldUsers.length} users in source database`);
    console.log(`📊 Found ${newUsers.length} users in target database`);

    // Build email to bio mapping
    const emailToBioMap = new Map<string, string>();
    let usersWithBio = 0;
    
    for (const oldUser of oldUsers) {
      if (oldUser.bio && oldUser.bio.trim() !== '' && oldUser.email) {
        emailToBioMap.set(oldUser.email.toLowerCase(), oldUser.bio);
        usersWithBio++;
      }
    }

    console.log(`✅ Found ${usersWithBio} users with bio in source database`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Update users with bios
    console.log('\n📝 Migrating bios to target database...');
    for (const newUser of newUsers) {
      try {
        const bio = emailToBioMap.get(newUser.email.toLowerCase());
        
        if (!bio) {
          skippedCount++;
          continue;
        }

        await targetUsersCollection.updateOne(
          { _id: newUser._id },
          { $set: { bio: bio } }
        );

        console.log(`✅ Updated ${newUser.email}: "${bio.substring(0, 50)}${bio.length > 50 ? '...' : ''}"`);
        updatedCount++;

      } catch (error: any) {
        console.error(`❌ Error updating user ${newUser.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${updatedCount} bios`);
    console.log(`⏭️  Skipped (no bio in source): ${skippedCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${newUsers.length}`);

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
console.log('🚀 Starting bio migration...\n');
migrateBios()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

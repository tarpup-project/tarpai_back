import { createConnection, Connection } from 'mongoose';

// Source database (old)
const SOURCE_DB = 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

// Target database (current)
const TARGET_DB = 'mongodb+srv://tarpai:Jumong25@henrycluster.cimmklx.mongodb.net/nestjs_db?retryWrites=true&w=majority';

interface OldUser {
  _id: any;
  fname?: string; // First name in old database
  name?: string;
  email: string;
  [key: string]: any;
}

interface NewUser {
  _id: any;
  name?: string;
  displayName?: string;
  email: string;
  [key: string]: any;
}

async function fixMissingNames() {
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

    // Build email to fname mapping
    const emailToFnameMap = new Map<string, string>();
    for (const oldUser of oldUsers) {
      if (oldUser.fname && oldUser.email) {
        emailToFnameMap.set(oldUser.email.toLowerCase(), oldUser.fname);
      }
    }

    console.log(`✅ Built mapping for ${emailToFnameMap.size} users with fname`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Update users with missing name or displayName
    console.log('\n📝 Updating users with missing names...');
    for (const newUser of newUsers) {
      try {
        const needsUpdate = !newUser.name || !newUser.displayName;
        
        if (!needsUpdate) {
          skippedCount++;
          continue;
        }

        const fname = emailToFnameMap.get(newUser.email.toLowerCase());
        
        if (!fname) {
          console.log(`⏭️  No fname found for ${newUser.email}`);
          skippedCount++;
          continue;
        }

        const updateFields: any = {};
        
        if (!newUser.name) {
          updateFields.name = fname;
        }
        
        if (!newUser.displayName) {
          updateFields.displayName = fname;
        }

        await targetUsersCollection.updateOne(
          { _id: newUser._id },
          { $set: updateFields }
        );

        console.log(`✅ Updated ${newUser.email}: name="${updateFields.name || 'unchanged'}", displayName="${updateFields.displayName || 'unchanged'}"`);
        updatedCount++;

      } catch (error: any) {
        console.error(`❌ Error updating user ${newUser.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} users`);
    console.log(`⏭️  Skipped (no update needed or no fname): ${skippedCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${newUsers.length}`);

  } catch (error) {
    console.error('❌ Update failed:', error);
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

// Run update
console.log('🚀 Starting name fix...\n');
fixMissingNames()
  .then(() => {
    console.log('\n✅ Update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });

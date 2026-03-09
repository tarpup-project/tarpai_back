# User Migration Guide

This guide explains how to migrate users from your old MongoDB database to the current one.

## Overview

The migration script will:
- Connect to both the source (old) and target (current) databases
- Fetch all users from the source database
- Check for existing users in the target database (by email)
- Skip users that already exist
- Generate unique usernames for users who don't have one
- Migrate user data with proper field mapping
- Provide a detailed summary of the migration

## Prerequisites

1. Make sure you have access to both databases
2. Ensure your `.env` file has the correct `DATABASE_URL` for the target database
3. The source database connection string is hardcoded in the script for safety

## How to Run

### Step 1: Review the Migration Script

Before running, review the script at `src/scripts/migrate-users.ts` to ensure:
- The source database URL is correct
- The target database URL matches your current setup
- Field mappings are appropriate for your needs

### Step 2: Run the Migration

```bash
npm run migrate-users
```

### Step 3: Monitor the Output

The script will show:
- ✅ Successfully migrated users
- ⏭️  Skipped users (already exist)
- ❌ Errors (if any)
- 📊 Final summary with counts

## What Gets Migrated

The following fields are migrated:
- `name` - User's full name
- `email` - Email address (used to check for duplicates)
- `password` - Existing hashed password (preserved as-is)
- `username` - Generated if not exists
- `bio` - User biography
- `avatar` - Profile picture URL (defaults to system default if missing)
- `isVerified` - Email verification status
- `followers` - Array of follower IDs
- `following` - Array of following IDs
- `createdAt` - Original creation date
- `updatedAt` - Last update date

## New Fields Added

The script automatically adds these fields for the new system:
- `displayName` - Set to the user's name
- `isSilentSignup` - Set to false
- `lastActiveAt` - Set to current date
- `yearlyBroadcastCount` - Set to 0

## Username Generation

If a user doesn't have a username:
1. It's generated from their email (part before @) or name
2. Special characters are removed
3. If the username exists, a number is appended (e.g., john1, john2)

## Safety Features

- **Duplicate Prevention**: Users with existing emails are skipped
- **No Data Loss**: Original database is only read from, never modified
- **Error Handling**: Individual user errors don't stop the entire migration
- **Detailed Logging**: Every action is logged for review

## Troubleshooting

### Connection Issues
If you get connection errors:
- Verify both database URLs are correct
- Check your network connection
- Ensure IP whitelist includes your current IP (for MongoDB Atlas)

### Duplicate Key Errors
If you get duplicate key errors:
- The script should handle this automatically
- Check if there are unique indexes on fields other than email

### Password Issues
- Passwords are migrated as-is (already hashed)
- Users should be able to log in with their existing passwords
- If passwords don't work, users can use "Forgot Password"

## Post-Migration Steps

1. **Verify User Count**: Check that the number of users matches expectations
2. **Test Login**: Try logging in with a migrated user account
3. **Check Relationships**: Verify followers/following relationships work
4. **Update Profiles**: Encourage users to update their profiles if needed

## Rollback

If something goes wrong:
- The source database is unchanged
- You can delete migrated users from the target database
- Re-run the migration after fixing issues

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Review the migration script for any needed customizations
3. Test with a small subset first by modifying the script

## Example Output

```
🚀 Starting user migration...

🔌 Connecting to source database...
✅ Connected to source database
🔌 Connecting to target database...
✅ Connected to target database
📥 Fetching users from source database...
📊 Found 150 users to migrate
✅ Migrated: user1@example.com (username: user1)
✅ Migrated: user2@example.com (username: user2)
⏭️  Skipping user3@example.com - already exists
...

📊 Migration Summary:
✅ Successfully migrated: 145
⏭️  Skipped (already exists): 5
❌ Errors: 0
📈 Total processed: 150

✅ Migration completed successfully!
```

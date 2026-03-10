import { createConnection, Connection } from 'mongoose';

// Source database (old)
const SOURCE_DB = 'mongodb+srv://travorproject:sleKHyeZp2htHzbw@cluster0.lsyy8.mongodb.net/project?retryWrites=true&w=majority';

const SEARCH_TEXT = 'Semiconductor R&D Engineer';

async function searchText() {
  let sourceConnection: Connection | null = null;

  try {
    console.log('🔌 Connecting to source database...');
    sourceConnection = createConnection(SOURCE_DB);
    await sourceConnection.asPromise();
    console.log('✅ Connected to source database');

    console.log(`\n🔍 Searching for: "${SEARCH_TEXT}"\n`);

    // Get all collections
    const collections = await sourceConnection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections to search\n`);

    let foundCount = 0;

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = sourceConnection.collection(collectionName);

      try {
        // Search for the text in all fields
        const results = await collection.find({
          $or: [
            { bio: { $regex: SEARCH_TEXT, $options: 'i' } },
            { description: { $regex: SEARCH_TEXT, $options: 'i' } },
            { about: { $regex: SEARCH_TEXT, $options: 'i' } },
            { content: { $regex: SEARCH_TEXT, $options: 'i' } },
            { text: { $regex: SEARCH_TEXT, $options: 'i' } },
          ]
        }).toArray();

        if (results.length > 0) {
          console.log(`✅ Found ${results.length} match(es) in collection: ${collectionName}`);
          
          results.forEach((doc, index) => {
            console.log(`\n--- Match ${index + 1} ---`);
            console.log(`Collection: ${collectionName}`);
            console.log(`Document ID: ${doc._id}`);
            
            // Show relevant fields
            const relevantFields = ['bio', 'description', 'about', 'content', 'text', 'fname', 'name', 'email', 'username'];
            relevantFields.forEach(field => {
              if (doc[field]) {
                console.log(`${field}: ${doc[field]}`);
              }
            });
            
            foundCount++;
          });
        }
      } catch (error: any) {
        // Skip collections that don't support text search
        if (!error.message.includes('$regex')) {
          console.log(`⏭️  Skipping ${collectionName}: ${error.message}`);
        }
      }
    }

    if (foundCount === 0) {
      console.log('\n❌ No matches found');
    } else {
      console.log(`\n✅ Total matches found: ${foundCount}`);
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
    throw error;
  } finally {
    if (sourceConnection) {
      await sourceConnection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run search
console.log('🚀 Starting search...\n');
searchText()
  .then(() => {
    console.log('\n✅ Search completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Search failed:', error);
    process.exit(1);
  });

const { MongoClient } = require("mongodb");

// Vercel reuses warm functions, so we keep one connection and reuse it.
let client;
let db;

async function getDb() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  return db;
}

module.exports = { getDb };

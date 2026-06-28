

const {MongoClient, ServerApiVersion} = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w0obvc9.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

const connectDB = async () => {
     try {
        await client.connect();
        db = client.db('zap_shift_db');
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
     } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1); 
  }
}

// ==-== get all collection dynamically by calling this function ==-== //
const getCollection = (collectionName) => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db.collection(collectionName);
};

module.exports = { connectDB, getCollection };
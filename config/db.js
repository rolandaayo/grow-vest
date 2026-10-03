const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return; // reuse existing connection in serverless

  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes("<cluster-host>")) {
    throw new Error(
      "MONGO_URI is not configured. Set it in your Vercel environment variables.",
    );
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s timeout for serverless cold starts
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    isConnected = false;
    console.error(`❌ MongoDB connection error: ${err.message}`);
    throw err; // let the route handler return a 503 instead of crashing
  }
};

module.exports = connectDB;

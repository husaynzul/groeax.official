import mongoose from "mongoose";

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn("[MongoDB] MONGO_URI not set — MongoDB features disabled.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("[MongoDB] Connection failed:", err);
    process.exit(1);
  }
}

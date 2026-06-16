import { MongoClient, ObjectId } from "mongodb";

let client;
let db;

export { ObjectId };

export async function connectDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  await ensureIndexes(db);
  return db;
}

export function getClient() {
  if (!client) {
    throw new Error("Database is not connected");
  }
  return client;
}

async function ensureIndexes(database) {
  await database.collection("rooms").createIndex({ name: 1 }, { unique: true });
  await database.collection("bookings").createIndex({ "bookedBy.email": 1, date: 1 });
  await database.collection("bookings").createIndex({ roomId: 1, date: 1, startTime: 1 });
  await database.collection("userDailyQuotas").createIndex({ email: 1, date: 1 }, { unique: true });

  await database.collection("slotHolds").createIndex(
    { roomId: 1, date: 1, slotStart: 1 },
    {
      unique: true,
      partialFilterExpression: { status: "held" }
    }
  );
}

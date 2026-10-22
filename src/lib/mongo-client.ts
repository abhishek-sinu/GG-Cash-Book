import { MongoClient } from "mongodb";

export function mongoConfiguration() {
  let uri = process.env.MONGODB_URI?.trim();
  const database = process.env.MONGODB_DB_NAME?.trim();
  if (!uri || !database) throw new Error("Configure MONGODB_URI and MONGODB_DB_NAME in .env.local.");
  for (const [pattern, value] of [
    [/<(?:db_)?username>/gi, process.env.MONGODB_USERNAME],
    [/<(?:db_)?password>/gi, process.env.MONGODB_PASSWORD],
  ] as const) {
    uri = uri.replace(pattern, () => {
      if (!value) throw new Error("MongoDB URI placeholders require the corresponding username/password environment variables.");
      return encodeURIComponent(value);
    });
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) throw new Error("MONGODB_URI must be a valid MongoDB connection string without unresolved placeholders.");
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(database)) throw new Error("MONGODB_DB_NAME must contain only letters, digits, underscores, or hyphens.");
  return { uri, database };
}

const globalMongo = globalThis as typeof globalThis & { cashBookMongo?: MongoClient };

export async function getMongoClient() {
  const { uri } = mongoConfiguration();
  // One long-running Next.js process reuses the driver's default connection pool.
  const client = globalMongo.cashBookMongo ??= new MongoClient(uri);
  await client.connect();
  return client;
}

import "server-only";
import { getMongoClient, mongoConfiguration } from "./mongo-client";

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(mongoConfiguration().database);
}

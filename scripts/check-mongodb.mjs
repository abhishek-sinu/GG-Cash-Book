import { getMongoClient, mongoConfiguration } from "../src/lib/mongo-client.ts";

let client;
try {
  const { database } = mongoConfiguration();
  client = await getMongoClient();
  await client.db(database).command({ ping: 1 });
  console.log(`MongoDB connection verified. Selected application database: ${database}.`);
  console.log("Read-only ping completed. No collections or records were created or changed.");
} catch (error) {
  // Driver error messages may include connection details; never print credentials.
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  console.error(`MongoDB connection check failed (${name}${code ? `, code ${code}` : ""}).`);
  console.error("Check the environment configuration, credentials, cluster availability, and Atlas IP access list.");
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}

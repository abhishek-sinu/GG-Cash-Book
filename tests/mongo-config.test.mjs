import assert from "node:assert/strict";
import { test } from "node:test";
import { mongoConfiguration } from "../src/lib/mongo-client.ts";

test("MongoDB configuration validates input and encodes credential placeholders", () => {
  const keys = ["MONGODB_URI", "MONGODB_DB_NAME", "MONGODB_USERNAME", "MONGODB_PASSWORD"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    keys.forEach(key => delete process.env[key]);
    assert.throws(() => mongoConfiguration(), /Configure/);
    process.env.MONGODB_DB_NAME = "gg_cash_book";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
    assert.equal(mongoConfiguration().database, "gg_cash_book");
    process.env.MONGODB_URI = "mongodb+srv://<db_username>:<db_password>@example.invalid/";
    assert.throws(() => mongoConfiguration(), /placeholders/);
    process.env.MONGODB_USERNAME = "test@user";
    process.env.MONGODB_PASSWORD = "fake:p/a ss#";
    assert.equal(mongoConfiguration().uri, "mongodb+srv://test%40user:fake%3Ap%2Fa%20ss%23@example.invalid/");
    process.env.MONGODB_DB_NAME = "bad/name";
    assert.throws(() => mongoConfiguration(), /MONGODB_DB_NAME/);
    process.env.MONGODB_DB_NAME = "gg_cash_book";
    process.env.MONGODB_URI = "https://example.invalid";
    assert.throws(() => mongoConfiguration(), /connection string/);
    process.env.MONGODB_URI = "mongodb+srv://<unknown>@example.invalid";
    assert.throws(() => mongoConfiguration(), /placeholders/);
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

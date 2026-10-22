import assert from "node:assert/strict";
import { test } from "node:test";
import { credentials } from "../src/lib/account-validation.ts";
import { hash, compare } from "bcryptjs";

test("credentials normalize email, preserve password and validate registration name", () => {
  assert.deepEqual(credentials({ email: "  User@Example.com ", password: "a-long-password", name: " Test " }, true), { email: "user@example.com", password: "a-long-password", name: "Test" });
  for (const input of [null, {}, { email: "bad", password: "a-long-password" }, { email: "u@example.com", password: "short" }, { email: { $ne: null }, password: "a-long-password" }, { email: "u@example.com", password: "🙂".repeat(20) }]) assert.throws(() => credentials(input));
  assert.throws(() => credentials({ email: "u@example.com", password: "a-long-password", name: " " }, true));
});

test("password hashes verify without storing plain text", async () => {
  const password = "test-only-long-password";
  const passwordHash = await hash(password, 12);
  assert.notEqual(passwordHash, password);
  assert.equal(await compare(password, passwordHash), true);
  assert.equal(await compare("wrong-long-password", passwordHash), false);
});

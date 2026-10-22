import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { getDatabase } from "./mongodb";
import { HttpError } from "./http";

type User = { _id: string; name: string; email: string; passwordHash: string; createdAt: Date };
type Session = { _id: string; userId: string; expiresAt: Date };
type RateLimit = { _id: string; count: number; expiresAt: Date };
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-gg-session" : "gg-session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
let indexes: Promise<unknown> | undefined;
let dummyHash: Promise<string> | undefined;

export async function accountCollections() {
  const db = await getDatabase();
  const users = db.collection<User>("cashbook_users");
  const sessions = db.collection<Session>("cashbook_sessions");
  const limits = db.collection<RateLimit>("cashbook_auth_limits");
  indexes ??= Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return { users, sessions, limits };
}

export async function throttle(action: string, key: string, max: number) {
  const { limits } = await accountCollections();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const bucket = Math.floor(now / windowMs);
  const id = digest(`${action}:${key}:${bucket}`);
  const value = await limits.findOneAndUpdate({ _id: id }, {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
  }, { upsert: true, returnDocument: "after" });
  if (!value || value.count > max) throw new HttpError(429, "Too many attempts. Please wait up to 15 minutes and try again.");
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { users, sessions } = await accountCollections();
  const session = await sessions.findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await users.findOne({ _id: session.userId });
  return user ? { id: user._id, name: user.name, email: user.email } : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}

async function startSession(userId: string) {
  const jar = await cookies();
  const { sessions } = await accountCollections();
  const old = jar.get(COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  await sessions.insertOne({ _id: digest(token), userId, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  if (old) await sessions.deleteOne({ _id: digest(old) });
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS });
}

export async function registerAccount(name: string, email: string, password: string) {
  const { users } = await accountCollections();
  const user = { _id: randomUUID(), name, email, passwordHash: await hash(password, 12), createdAt: new Date() };
  try { await users.insertOne(user); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) throw new HttpError(409, "An account could not be created with those details. Try signing in instead.");
    throw error;
  }
  await startSession(user._id);
  return { id: user._id, name, email };
}

export async function loginAccount(email: string, password: string) {
  const { users } = await accountCollections();
  const user = await users.findOne({ email });
  dummyHash ??= hash(randomBytes(32).toString("hex"), 12);
  const valid = await compare(password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) throw new HttpError(401, "Email or password is incorrect.");
  await startSession(user._id);
  return { id: user._id, name: user.name, email: user.email };
}

export async function logoutAccount() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const { sessions } = await accountCollections();
    await sessions.deleteOne({ _id: digest(token) });
  }
  jar.delete(COOKIE);
}

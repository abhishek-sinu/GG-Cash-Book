export function credentials(input: unknown, registration = false) {
  if (typeof input !== "object" || input === null) throw new Error("Enter your email and password.");
  const data = input as Record<string, unknown>;
  if (typeof data.email !== "string" || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) throw new Error("Enter a valid email address.");
  if (typeof data.password !== "string" || data.password.length < 12 || new TextEncoder().encode(data.password).length > 72) throw new Error("Use a password of at least 12 characters and no more than 72 UTF-8 bytes.");
  const name = registration && typeof data.name === "string" ? data.name.trim() : "";
  if (registration && (!name || name.length > 60)) throw new Error("Enter your name (up to 60 characters).");
  return { email: data.email.trim().toLowerCase(), password: data.password, name };
}

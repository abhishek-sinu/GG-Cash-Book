import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next.js can normalize request.url to localhost even when accessed via 127.0.0.1.
  const expected = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Request origin is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "Send JSON content.");
}

export async function readJson(request: Request, limit = 8192): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > limit) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(part.value);
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); }
  catch { throw new HttpError(400, "Request must contain valid JSON."); }
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Database errors can contain connection details; expose only their type.
  console.error("Account API operation failed:", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "The account service is unavailable. Check the MongoDB connection and try again." }, 503);
}

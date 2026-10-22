import { currentUser, loginAccount, logoutAccount, registerAccount, throttle } from "@/lib/accounts";
import { credentials } from "@/lib/account-validation";
import { apiError, HttpError, json, readJson, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try { return json({ user: await currentUser() }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readJson(request);
    if (typeof body !== "object" || body === null || !("action" in body)) throw new HttpError(400, "Choose an account action.");
    if (body.action === "logout") { await logoutAccount(); return json({ user: null }); }
    if (body.action !== "register" && body.action !== "login") throw new HttpError(400, "Unknown account action.");
    let data;
    try { data = credentials(body, body.action === "register"); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "Invalid credentials."); }
    await throttle("account-global", "all", 200);
    await throttle(body.action, data.email, body.action === "register" ? 5 : 10);
    const user = body.action === "register" ? await registerAccount(data.name, data.email, data.password) : await loginAccount(data.email, data.password);
    return json({ user }, body.action === "register" ? 201 : 200);
  } catch (error) { return apiError(error); }
}

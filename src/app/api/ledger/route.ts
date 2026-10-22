import { BSON } from "mongodb";
import { requireUser } from "@/lib/accounts";
import { getDatabase } from "@/lib/mongodb";
import { apiError, HttpError, json, readJson, sameOrigin } from "@/lib/http";
import { emptyLedger, validateLedger, type Ledger } from "@/lib/ledger";

type Document = { _id: string; revision: number; ledger: Ledger };
export const runtime = "nodejs";

async function collection() { return (await getDatabase()).collection<Document>("cashbook_ledgers"); }

export async function GET() {
  try {
    const user = await requireUser();
    const ledgers = await collection();
    const result = await ledgers.findOneAndUpdate({ _id: user.id }, { $setOnInsert: { revision: 0, ledger: emptyLedger } }, { upsert: true, returnDocument: "after" });
    if (!result) throw new HttpError(503, "Ledger could not be loaded.");
    return json({ ledger: result.ledger, revision: result.revision, accountId: user.id });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, 10_000_000);
    if (typeof body !== "object" || body === null || !("revision" in body) || !Number.isSafeInteger(body.revision) || typeof body.revision !== "number" || body.revision < 0 || !("ledger" in body)) throw new HttpError(400, "A ledger and valid revision are required.");
    if (!("accountId" in body) || body.accountId !== user.id) throw new HttpError(409, "The signed-in account changed. Reload before saving.");
    let ledger: Ledger;
    try { ledger = validateLedger(body.ledger); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "Invalid ledger."); }
    if (BSON.calculateObjectSize({ ledger }) > 10_000_000) throw new HttpError(413, "Ledger exceeds the 10 MB account limit. Export and archive older records.");
    const result = await (await collection()).findOneAndUpdate({ _id: user.id, revision: body.revision }, { $set: { ledger }, $inc: { revision: 1 } }, { returnDocument: "after" });
    if (!result) throw new HttpError(409, "Records changed in another tab or device. Reload the latest records before saving.");
    return json({ ledger: result.ledger, revision: result.revision, accountId: user.id });
  } catch (error) { return apiError(error); }
}

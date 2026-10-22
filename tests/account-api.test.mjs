import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const base = process.env.CASHBOOK_TEST_URL;

test("live account API: sessions, privacy, CSRF, revisions and login throttling", { skip: !base }, async () => {
  const origin = new URL(base).origin;
  const password = `${randomUUID()}-test`;
  const run = randomUUID();
  const sessions = [];
  async function request(path, { method = "GET", body, cookie, requestOrigin = origin } = {}) {
    const response = await fetch(new URL(path, origin), {
      method, headers: { "Content-Type": "application/json", Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    return { response, data };
  }
  try {
    assert.equal((await request("/api/ledger")).response.status, 401);
    assert.equal((await request("/api/account")).data.user, null);
    for (const suffix of ["a", "b"]) {
      const email = `qa-api-${run}-${suffix}@example.invalid`;
      const { response, data } = await request("/api/account", { method: "POST", body: { action: "register", name: "QA API " + suffix, email, password } });
      assert.equal(response.status, 201);
      const cookieHeader = response.headers.get("set-cookie");
      assert.match(cookieHeader, /HttpOnly/i);
      assert.match(cookieHeader, /SameSite=strict/i);
      assert.equal("passwordHash" in data.user, false);
      sessions.push({ cookie: cookieHeader.split(";")[0], account: data.user, email });
    }
    const [a, b] = sessions;
    const first = await request("/api/ledger", { cookie: a.cookie });
    assert.equal(first.data.accountId, a.account.id);
    assert.match(first.response.headers.get("cache-control"), /no-store/);
    const ledger = { version: 1, books: [{ id: "qa-private", name: "QA private book", kind: "everyday", budget: 0 }], entries: [] };
    const payload = { accountId: a.account.id, revision: first.data.revision, ledger };
    assert.equal((await request("/api/ledger", { method: "PUT", cookie: a.cookie, body: payload, requestOrigin: "https://different-origin.invalid" })).response.status, 403);
    const saved = await request("/api/ledger", { method: "PUT", cookie: a.cookie, body: payload });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.data.ledger.books.length, 1);
    assert.equal((await request("/api/ledger", { method: "PUT", cookie: a.cookie, body: payload })).response.status, 409);
    assert.equal((await request("/api/ledger", { method: "PUT", cookie: b.cookie, body: payload })).response.status, 409);
    const other = await request("/api/ledger", { cookie: b.cookie });
    assert.equal(other.data.ledger.books.length, 0);
    const invalid = await request("/api/ledger", { method: "PUT", cookie: a.cookie, body: { ...payload, revision: saved.data.revision, ledger: { ...ledger, entries: [{ amount: -1 }] } } });
    assert.equal(invalid.response.status, 400);
    const duplicate = await request("/api/account", { method: "POST", body: { action: "register", name: "QA Duplicate", email: a.email.toUpperCase(), password } });
    assert.equal(duplicate.response.status, 409);
    const wrong = await request("/api/account", { method: "POST", body: { action: "login", email: a.email, password: "wrong-password-long" } });
    assert.equal(wrong.response.status, 401);
    const signedIn = await request("/api/account", { method: "POST", body: { action: "login", email: a.email, password } });
    assert.equal(signedIn.response.status, 200);
    const newCookie = signedIn.response.headers.get("set-cookie").split(";")[0];
    assert.notEqual(newCookie, a.cookie);
    sessions.push({ cookie: newCookie });
    const signedOut = await request("/api/account", { method: "POST", cookie: newCookie, body: { action: "logout" } });
    assert.equal(signedOut.response.status, 200);
    assert.equal((await request("/api/ledger", { cookie: newCookie })).response.status, 401);
    const noUser = `qa-limit-${run}@example.invalid`;
    for (let i = 0; i < 11; i++) {
      const attempt = await request("/api/account", { method: "POST", body: { action: "login", email: noUser, password } });
      assert.equal(attempt.response.status, i < 10 ? 401 : 429);
    }
  } finally {
    // Clean only ledgers and sessions belonging to accounts created by this test.
    for (const session of sessions) {
      if (session.account) {
        const current = await request("/api/ledger", { cookie: session.cookie });
        if (current.response.ok) {
          const reset = await request("/api/ledger", { method: "PUT", cookie: session.cookie, body: { accountId: session.account.id, revision: current.data.revision, ledger: { version: 1, books: [], entries: [] } } });
          assert.equal(reset.response.status, 200);
        }
      }
      await request("/api/account", { method: "POST", cookie: session.cookie, body: { action: "logout" } });
    }
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { COOKIES, signToken } from "../src/lib/tokens";

const url = "https://vote.example.com";

test("BUG-008: a voter Server Action with no cookie reaches its own session check", async () => {
  const response = await proxy(new NextRequest(`${url}/vote`, {
    method: "POST",
    headers: { "Next-Action": "submit-vote-action" },
  }));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("voter Server Actions with invalid or expired cookies also reach their own session checks", async (t) => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "qa-proxy-tests-only-secret-at-least-32-characters";
  t.after(() => {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });
  const expired = await signToken({ typ: "voter", sid: "qa-scholar" }, -60);
  for (const cookie of ["invalid-token", expired]) {
    const response = await proxy(new NextRequest(`${url}/vote`, {
      method: "POST",
      headers: { "Next-Action": "submit-vote-action", cookie: `${COOKIES.voter}=${cookie}` },
    }));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    const pageResponse = await proxy(new NextRequest(`${url}/vote`, {
      headers: { cookie: `${COOKIES.voter}=${cookie}` },
    }));
    assert.equal(pageResponse.headers.get("location"), `${url}/`);
  }
});

test("unauthenticated voter page visits and ordinary POSTs still redirect to sign-in", async () => {
  for (const [pathname, method, headers] of [
    ["/vote", "GET", {}],
    ["/vote/done", "GET", {}],
    ["/vote", "GET", { "Next-Action": "not-a-post" }],
    ["/vote", "POST", {}],
  ] as const) {
    const response = await proxy(new NextRequest(url + pathname, { method, headers }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `${url}/`);
  }
});

test("a forged action header does not bypass the admin route guard", async () => {
  const response = await proxy(new NextRequest(`${url}/admin/scholars`, {
    method: "POST",
    headers: { "Next-Action": "not-authorized" },
  }));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${url}/admin/login?next=%2Fadmin%2Fscholars`);
});

// Uses an isolated cookie jar. Changes only its own prototype cart, never an EKT order.
import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
function client() {
  const cookies = new Map();
  return async (path, body) => {
    const response = await fetch(`${base}/api/cart${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(base).origin,
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60000),
    });
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(";", 1)[0],
        cut = first.indexOf("=");
      cookies.set(first.slice(0, cut), first.slice(cut + 1));
    }
    return { status: response.status, data: await response.json() };
  };
}
const api = client();
const selection = {
  productId: 515283,
  quantity: 10,
  sourceCity: null,
  originalId: null,
};
const before = await api("");
assert.equal(before.status, 200);
assert.equal(before.data.state.items.length, 0);
const quote = await api("/quote", {
  city: "Алматы",
  operation: "append",
  items: [{ ...selection, unitPrice: 1 }],
});
assert.equal(quote.status, 200, JSON.stringify(quote.data));
assert.ok(quote.data.lines[0].unitPrice > 1);
assert.ok(quote.data.warnings.length);
assert.equal(
  quote.data.lines[0].allocations.reduce((s, a) => s + a.quantity, 0),
  10,
);
assert.equal(
  (await api("")).data.state.items.length,
  0,
  "Quote must not mutate cart",
);
assert.equal(
  (await api("/confirm", { token: quote.data.token, confirmed: false })).status,
  400,
);
assert.equal(
  (await api("/confirm", { token: quote.data.token, confirmed: true })).status,
  400,
);
assert.equal(
  (
    await api("/confirm", {
      token: quote.data.token + "x",
      confirmed: true,
      acknowledgeWarnings: true,
    })
  ).status,
  403,
);
assert.equal(
  (
    await client()("/confirm", {
      token: quote.data.token,
      confirmed: true,
      acknowledgeWarnings: true,
    })
  ).status,
  403,
);
const confirmed = await api("/confirm", {
  token: quote.data.token,
  confirmed: true,
  acknowledgeWarnings: true,
});
assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
assert.equal(
  (
    await api("/confirm", {
      token: quote.data.token,
      confirmed: true,
      acknowledgeWarnings: true,
    })
  ).data.unchanged,
  true,
);
const saved = await api("");
assert.equal(saved.data.state.items[0].quantity, 10);
assert.equal(saved.data.total, quote.data.total);
const conflict = await api("/quote", {
  city: "Алматы",
  operation: "append",
  items: [{ ...selection, productId: 515291, quantity: 1 }],
});
assert.equal(conflict.status, 409);
const stale = await api("/quote", {
  city: "Алматы",
  operation: "replace",
  items: [{ ...selection, quantity: 2 }],
});
assert.equal(stale.status, 200);
const clear = await api("/quote", {
  city: "Алматы",
  operation: "replace",
  items: [],
});
assert.equal(clear.status, 200);
assert.equal(
  (await api("")).data.state.items.length,
  1,
  "Clear also needs explicit confirmation",
);
assert.equal(
  (await api("/confirm", { token: clear.data.token, confirmed: true })).status,
  200,
);
assert.equal(
  (
    await api("/confirm", {
      token: stale.data.token,
      confirmed: true,
      acknowledgeWarnings: true,
    })
  ).status,
  409,
);
assert.equal((await api("")).data.state.items.length, 0);
console.log(
  JSON.stringify(
    {
      base,
      result: "PASS",
      checks: [
        "live EKT price and warehouse allocation",
        "quote leaves cart unchanged",
        "explicit confirmation required",
        "delivery acknowledgment required",
        "tampered token rejected",
        "cross-session token rejected",
        "confirmed cart persists",
        "repeat confirmation idempotent",
        "160/250 A conflict blocked",
        "clear requires confirmation",
        "stale quote rejected",
      ],
    },
    null,
    2,
  ),
);

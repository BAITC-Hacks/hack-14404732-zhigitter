import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const checks = [];
async function chat(content, before = []) {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: "Алматы",
      messages: [...before, { role: "user", content }],
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  assert.equal(body.cartChanged, false);
  return body;
}
const vague = await chat("Нужен автомат для квартиры");
assert.equal(vague.clarification, true);
assert.equal(vague.cards.length, 0);
assert.match(vague.text, /ток/);
assert.match(vague.text, /полюсов/);
checks.push("vague breaker asks two questions without guessed goods");
const before = [
  { role: "user", content: "Нужен автомат для квартиры" },
  {
    role: "assistant",
    content: JSON.stringify({ text: vague.text, clarification: true }),
  },
];
const partial = await chat("40 А", before);
assert.equal(partial.clarification, true);
assert.match(partial.text, /полюсов/);
checks.push("short answer retains current and asks only for missing poles");
const follow = await chat("3P, 10 штук", [
  ...before,
  { role: "user", content: "40 А" },
  {
    role: "assistant",
    content: JSON.stringify({ text: partial.text, clarification: true }),
  },
]);
const main = follow.cards.filter((c) => !c.comparison);
assert.ok(main.length > 0);
assert.ok(
  main.every(
    (c) =>
      /40\s*[аa]/i.test(c.product.name) && /3\s*[фpр]/i.test(c.product.name),
  ),
);
assert.equal(main[0].requestedQuantity, 10);
checks.push(
  "multi-turn 40 A / 3P / quantity 10 returns matching live products",
);
const exact = await chat("Автомат 027024, 2 штуки");
assert.equal(exact.cards.find((c) => !c.comparison)?.product.id, 515283);
assert.notEqual(exact.clarification, true);
checks.push("exact article bypasses clarification and preserves SKU");
const terminal = await chat("Нужна клемма");
assert.equal(terminal.cards.length, 0);
assert.match(terminal.text, /проводников/);
checks.push("terminal asks for conductor count");
const unknown = await chat("Не знаю", before);
assert.equal(unknown.cards.length, 0);
assert.match(unknown.text, /По фото/);
checks.push("unknown parameters offers photo instead of guessing");
const kk = await chat("Маған автомат керек");
assert.equal(kk.language, "kk");
assert.equal(kk.cards.length, 0);
checks.push("Kazakh clarification stays Kazakh");
const products = await Promise.all(
  [515283, 515291].map(async (id) => {
    const r = await fetch(`${base}/api/catalog/${id}?refresh=1`);
    assert.equal(r.status, 200);
    return r.json();
  }),
);
assert.ok(
  products.every(
    (p) => typeof p.price === "number" && p.fetchedAt && p.stores.length,
  ),
);
assert.equal(products[1].id, 515291);
checks.push(
  "both comparison products have fresh EKT prices, stocks and source timestamps",
);
console.log(
  JSON.stringify(
    {
      base,
      result: "PASS",
      checks,
      matchingIds: main.map((c) => c.product.id),
      prices: products.map((p) => ({ id: p.id, price: p.price })),
    },
    null,
    2,
  ),
);

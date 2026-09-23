import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
async function chat(text, previous) {
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: "Алматы",
      messages: [
        ...(previous
          ? [
              {
                role: "assistant",
                content: JSON.stringify({
                  priceComparison: previous.priceComparison,
                  clarification: previous.clarification,
                  items: previous.cards.map((c) => ({ id: c.product.id })),
                }),
              },
            ]
          : []),
        { role: "user", content: text },
      ],
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  assert.equal(body.cartChanged, false);
  return body;
}
const pair = await chat("Сравни цены 027024 и 027228");
assert.equal(pair.priceComparison, true);
assert.equal(pair.clarification, false);
assert.deepEqual(pair.cards.map((c) => c.product.id).sort(), [515283, 515291]);
const difference = Math.abs(
  pair.cards[0].product.price - pair.cards[1].product.price,
);
assert.ok(pair.text.replace(/\s/g, "").includes(String(difference)));
assert.ok(pair.cards.some((c) => c.conflicts.length));
const missing = await chat("Сравни цены 027024");
assert.equal(missing.clarification, true);
const followup = await chat("027228", missing);
assert.equal(followup.cards.length, 2);
assert.equal(followup.clarification, false);
const context = await chat("Сравни цены товаров из последнего ответа", pair);
assert.equal(context.cards.length, 2);
const unknown = await chat("Сравни цены 027024 и 999999", pair);
assert.equal(unknown.clarification, true);
console.log(
  JSON.stringify(
    {
      base,
      result: "PASS",
      checks: [
        "exact pair with live price difference",
        "supplier conflict retained",
        "missing article clarified",
        "follow-up completes pair",
        "latest pair context",
        "unknown article not substituted",
      ],
      difference,
    },
    null,
    2,
  ),
);

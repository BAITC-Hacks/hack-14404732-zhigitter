import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const checks = [];
async function chat(text, salesHelp) {
  const start = Date.now();
  const r = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: "Алматы",
      messages: [{ role: "user", content: text }],
      ...(salesHelp ? { salesHelp } : {}),
    }),
  });
  const b = await r.json();
  assert.equal(r.status, 200, b.error);
  assert.equal(b.cartChanged, false);
  return { b, ms: Date.now() - start };
}
const exact = await chat("Нужны 2 штуки 027024 в Алматы");
assert.equal(exact.b.cards.find((c) => !c.comparison)?.product.id, 515283);
checks.push({
  name: "previously failed exact query bypasses AI",
  ms: exact.ms,
});
const terms = await chat("Какая минимальная партия 027024?");
assert.ok(terms.b.terms.some((t) => /кратность продажи/i.test(t.text)));
checks.push({
  name: "minimum answer uses SKU sale multiple and distinguishes missing order minimum",
  ms: terms.ms,
});
for (const kind of ["budget", "urgent", "approval", "compatibility"]) {
  const { b, ms } = await chat("Помоги с выбором", {
    kind,
    productId: kind === "budget" ? 33733 : 515283,
    quantity: 2,
  });
  assert.equal(b.salesHelp.kind, kind);
  assert.ok(b.salesHelp.summary.length > 30);
  if (kind === "approval" || kind === "compatibility") {
    assert.match(b.salesHelp.draft, /027024/);
    assert.match(b.salesHelp.draft, /резерв не созданы/);
  }
  if (kind === "budget") {
    const original = b.cards.find((c) => !c.comparison);
    for (const c of b.cards.filter((c) => c.comparison)) {
      assert.ok(c.product.price < original.product.price);
      assert.equal(c.comparison.blocked, false);
    }
  }
  checks.push({ name: `sales help ${kind}`, ms });
}
for (const kind of ["docx", "xlsx"]) {
  const file = await fs.readFile(`tests/fixtures/order.${kind}`);
  const form = new FormData();
  form.set("mode", "list");
  form.set("city", "Алматы");
  form.set("file", new Blob([file]), `order.${kind}`);
  const r = await fetch(base + "/api/attachments", {
    method: "POST",
    body: form,
  });
  const b = await r.json();
  assert.equal(r.status, 200, b.error);
  assert.equal(b.items.find((i) => i.marking === "027024")?.quantity, 2);
  assert.equal(b.items.find((i) => i.marking === "221-413")?.quantity, 3);
  checks.push({ name: `real ${kind} upload preserves codes and quantities` });
}
console.log(JSON.stringify({ base, result: "PASS", checks }, null, 2));

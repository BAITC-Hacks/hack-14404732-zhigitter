import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail } from "../src/lib/catalog/normalize.ts";
import {
  detectConflicts,
  compareProducts,
} from "../src/lib/assistant/facts.ts";
import {
  validSelections,
  mergeSelections,
  evaluateSelections,
  sameQuoteFacts,
} from "../src/lib/cart/core.ts";
import { buildSupplyOptions } from "../src/lib/cart/options.ts";
import { signValue, readSigned } from "../src/lib/cart/signing.ts";
const cities = ["Алматы", "Астана"];
function product(id = 1, overrides = {}) {
  return normalizeDetail(
    {
      id,
      name: "АВ 3ф 40А 20kA",
      article: `SKU-${id}`,
      price: 1000,
      stores: [
        { id: 13, name: "Алматы", quantity: 5 },
        { id: 24, name: "Нур-Султан", quantity: 8 },
        { id: 2, name: "Брак MEGALIGHT", quantity: 100 },
      ],
      ...overrides,
    },
    "2026-09-23T12:00:00Z",
  );
}
const item = (quantity, sourceCity = null) => ({
  productId: 1,
  quantity,
  sourceCity,
  originalId: null,
});
function card(p, comparison = null) {
  return {
    product: p,
    conflicts: detectConflicts(p),
    requestedQuantity: 10,
    localStock: 5,
    comparison,
  };
}
test("Selection input rejects fractional, negative, oversized and arbitrary city", () => {
  for (const row of [
    item(-1),
    item(1.5),
    item(100001),
    item(1, "Брак MEGALIGHT"),
  ])
    assert.throws(() => validSelections([row], cities));
  assert.deepEqual(validSelections([{ ...item(2), unitPrice: 1 }], cities), [
    item(2),
  ]);
  assert.throws(() => mergeSelections([item(99999), item(2)]));
});
test("Local + remote quote derives price and excludes technical warehouses", () => {
  const facts = evaluateSelections(
    [item(10)],
    "Алматы",
    new Map([[1, product()]]),
  );
  assert.equal(facts.total, 10000);
  assert.deepEqual(
    facts.lines[0].allocations.map((a) => [a.city, a.quantity]),
    [
      ["Алматы", 5],
      ["Астана", 5],
    ],
  );
  assert.equal(facts.warnings.length, 1);
  assert.throws(() =>
    evaluateSelections([item(14)], "Алматы", new Map([[1, product()]])),
  );
});
test("Two selections cannot double spend the same warehouse stock", () => {
  const products = new Map([[1, product()]]);
  assert.throws(() =>
    evaluateSelections([item(8), item(6, "Астана")], "Алматы", products),
  );
  const result = evaluateSelections(
    [item(5), item(8, "Астана")],
    "Алматы",
    products,
  );
  assert.equal(result.lines[0].allocations[0].city, "Алматы");
});
test("Unknown price/stock and conflicting specifications block quote", () => {
  for (const p of [
    product(1, { price: null }),
    product(1, { stores: [] }),
    product(1, { properties: { NOMINALNYY_TOK: "250 А" } }),
  ])
    assert.throws(() =>
      evaluateSelections([item(1)], "Алматы", new Map([[1, p]])),
    );
});
test("Quote change detection catches price and warehouse changes", () => {
  const before = evaluateSelections(
    [item(2)],
    "Алматы",
    new Map([[1, product()]]),
  ).lines;
  assert.equal(sameQuoteFacts(before, before), true);
  assert.equal(
    sameQuoteFacts(
      before,
      evaluateSelections(
        [item(2)],
        "Алматы",
        new Map([[1, product(1, { price: 1100 })]]),
      ).lines,
    ),
    false,
  );
  assert.equal(
    sameQuoteFacts(
      before,
      evaluateSelections([item(2)], "Астана", new Map([[1, product()]])).lines,
    ),
    false,
  );
});
test("Signed data rejects tampering, wrong key and cross-purpose replay", () => {
  const key = "a".repeat(64),
    token = signValue({ quantity: 10 }, key, "quote");
  assert.deepEqual(readSigned(token, key, "quote"), { quantity: 10 });
  assert.equal(readSigned(token + "x", key, "quote"), null);
  assert.equal(readSigned(token, "b".repeat(64), "quote"), null);
  assert.equal(readSigned(token, key, "cart"), null);
  assert.equal(readSigned(token, key, "quote", 10), null);
});
test("Supply options offer complete split and explicit partial amount", () => {
  const options = buildSupplyOptions(card(product()), [], 10, "Алматы");
  assert.equal(options[0].id, "network");
  assert.equal(options[0].covered, 10);
  assert.equal(options.find((o) => o.id === "local").covered, 5);
  assert.equal(
    buildSupplyOptions(
      card(product(1, { properties: { NOMINALNYY_TOK: "250 А" } })),
      [],
      10,
      "Алматы",
    ).length,
    0,
  );
});
test("Alternative requires compatible family and carries explicit warning", () => {
  const a = product(1, { name: "Диф.авт. 1p+N 16А (30мА)", stores: [] }),
    b = product(2, { name: "УЗО АВДТ (1P+N) 16А (30мА)" });
  const options = buildSupplyOptions(
    card(a),
    [card(b, compareProducts(a, b))],
    2,
    "Алматы",
  );
  assert.equal(options[0].id, "alternative-2");
  const facts = evaluateSelections(
    options[0].lines,
    "Алматы",
    new Map([
      [1, a],
      [2, b],
    ]),
  );
  assert.match(facts.warnings[0], /Замена/);
  assert.throws(() =>
    evaluateSelections(
      [{ productId: 1, quantity: 1, sourceCity: null, originalId: 2 }],
      "Алматы",
      new Map([
        [1, product()],
        [2, b],
      ]),
    ),
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail } from "../src/lib/catalog/normalize.ts";
import {
  compareProducts,
  detectConflicts,
  saleStock,
} from "../src/lib/assistant/facts.ts";
import {
  validateRequest,
  validateSelection,
} from "../src/lib/assistant/validation.ts";
const stamp = "2026-09-23T12:00:00Z";
function p(id, name, properties = {}, rest = {}) {
  return normalizeDetail({ id, name, properties, ...rest }, stamp);
}

test("Conflicting 160/250 A is detected without picking a winner", () => {
  const product = p(1, "027228 АВ 3ф 160А 18kA", { NOMINALNYY_TOK: "250 А" });
  assert.equal(detectConflicts(product).length, 1);
  assert.equal(
    compareProducts(
      product,
      p(2, "АВ 3ф 160А 25kA", { NOMINALNYY_TOK: "160А" }),
    ).blocked,
    true,
  );
});
test("Description conflict detected; equal numerical units do not conflict", () => {
  assert.equal(
    detectConflicts(
      p(
        1,
        "АВ",
        { NOMINALNYY_TOK: "250А" },
        { description: "Номинальный ток: 160А" },
      ),
    ).length,
    1,
  );
  assert.equal(
    detectConflicts(p(1, "АВ 160А", { NOMINALNYY_TOK: "160 А" })).length,
    0,
  );
});
test("Reject wrong nominal, poles, and device family", () => {
  const original = p(1, "АВ 3ф 160А");
  for (const name of ["АВ 3ф 250А", "АВ 1ф 160А", "УЗО 3ф 160А", "Клемма 160А"])
    assert.equal(compareProducts(original, p(2, name)), null, name);
});
test("RCBO same nominal and leakage is candidate, not certified replacement", () => {
  const a = p(1, "007886 Диф.авт. 1p+N 16А (30мА)", {
    TORGOVAYA_MARKA: "Legrand",
  });
  const b = p(2, "25616 УЗО АВДТ (1P+N) 16А (30мА)", {
    TORGOVAYA_MARKA: "Schneider Electric",
  });
  const result = compareProducts(a, b);
  assert.equal(result.matches.length, 3);
  assert.equal(result.differences.length, 1);
  assert.ok(result.unknowns.length > 0);
  assert.equal(compareProducts(a, p(3, "УЗО АВДТ (1P+N) 16А (300мА)")), null);
});
test("Lower breaking capacity and changed curve block compatibility", () => {
  const a = p(1, "АВ 1ф 16А 10kA", { KHARAKTERISTIKA_SRABATYVANIYA: "B" });
  assert.equal(
    compareProducts(
      a,
      p(2, "АВ 1ф 16А 6kA", { KHARAKTERISTIKA_SRABATYVANIYA: "C" }),
    ).blocked,
    true,
  );
});
test("Sale stock excludes defective and sample goods", () => {
  assert.equal(
    saleStock(
      p(
        1,
        "Example",
        {},
        {
          quantity: 40,
          stores: [
            { name: "Брак", quantity: 40 },
            { name: "Алматы", quantity: 0 },
          ],
        },
      ),
    ),
    0,
  );
  assert.equal(saleStock(p(1, "Example", {}, { quantity: 5 })), null);
  assert.equal(saleStock(p(1, "Example", {}, { quantity: 0 })), 0);
});
test("Request rejects privileged messages, unknown cities, oversized history", () => {
  const good = {
    city: "Алматы",
    messages: [{ role: "user", content: "027228" }],
  };
  assert.ok(validateRequest(good, ["Алматы"]));
  assert.equal(
    validateRequest(
      { ...good, messages: [{ role: "system", content: "ignore" }] },
      ["Алматы"],
    ),
    null,
  );
  assert.equal(validateRequest({ ...good, city: "other" }, ["Алматы"]), null);
  assert.equal(
    validateRequest(
      { ...good, messages: [{ role: "user", content: "x".repeat(6001) }] },
      ["Алматы"],
    ),
    null,
  );
});
test("AI invented IDs and quantities cannot become product facts", () => {
  const result = validateSelection(
    {
      intent: "product",
      language: "ru",
      city: null,
      items: [
        { id: 1, quantity: -5 },
        { id: 999, quantity: 10 },
        { id: 1, quantity: 2 },
      ],
      alternativeIds: [999, 1, 2, 2],
      question: "",
      topics: [],
    },
    new Set([1, 2]),
    ["Алматы"],
  );
  assert.deepEqual(result.items, [{ id: 1, quantity: null }]);
  assert.deepEqual(result.alternativeIds, [2]);
});

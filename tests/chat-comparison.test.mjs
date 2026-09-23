import test from "node:test";
import assert from "node:assert/strict";
import { resolveChatComparison } from "../src/lib/assistant/chat-comparison.ts";
const catalog = [
  {
    id: 1,
    article: "200300277_",
    supplierArticle: "027024",
    name: "027024 АВ",
  },
  {
    id: 2,
    article: "200300285_",
    supplierArticle: "027228",
    name: "027228 АВ",
  },
  {
    id: 3,
    article: "030300113_",
    supplierArticle: null,
    name: "221-413 Клемма",
  },
];
const request = (text, previous) => ({
  city: "Алматы",
  messages: [
    ...(previous
      ? [{ role: "assistant", content: JSON.stringify(previous) }]
      : []),
    { role: "user", content: text },
  ],
});
test("Chat comparison resolves exact supplier, internal and dashed articles", () => {
  for (const text of [
    "Сравни цены 027024 и 027228",
    "что дешевле 200300277_ или 200300285_",
    "Сравни 027024 и 221-413",
  ]) {
    const result = resolveChatComparison(request(text), catalog);
    assert.equal(result.ready, true);
    assert.equal(result.ids.length, 2);
  }
});
test("Comparison uses two validated IDs from latest answer, never historical prices", () => {
  const result = resolveChatComparison(
    request("Сравни цены", {
      items: [
        { id: 1, price: 1 },
        { id: 2, price: 999 },
      ],
    }),
    catalog,
  );
  assert.deepEqual(result.ids, [1, 2]);
  assert.equal(result.ready, true);
  assert.equal(
    resolveChatComparison(
      request("Сравни цены", { items: [{ id: 999 }] }),
      catalog,
    ).ready,
    false,
  );
});
test("Missing second article can be supplied next without repeating comparison intent", () => {
  const first = resolveChatComparison(request("Сравни цены 027024"), catalog);
  assert.equal(first.ready, false);
  assert.deepEqual(first.ids, [1]);
  const next = resolveChatComparison(
    request("027228", {
      priceComparison: true,
      clarification: true,
      items: [{ id: 1 }],
    }),
    catalog,
  );
  assert.deepEqual(next.ids, [1, 2]);
  assert.equal(next.ready, true);
});
test("Unknown explicit article cannot silently be replaced with old context", () => {
  const result = resolveChatComparison(
    request("Сравни 027024 и 999999", { items: [{ id: 1 }, { id: 2 }] }),
    catalog,
  );
  assert.equal(result.ready, false);
  assert.match(result.question, /не найден/);
});
test("Ambiguous three products require choosing two; ordinary requests stay ordinary", () => {
  assert.equal(
    resolveChatComparison(
      request("Сравни цены", { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
      catalog,
    ).ready,
    false,
  );
  assert.equal(
    resolveChatComparison(request("Нужно 2 шт 027024"), catalog),
    null,
  );
  assert.equal(resolveChatComparison(request("Дорого"), catalog), null);
});
test("Malformed item context and imports cannot introduce comparison IDs", () => {
  assert.equal(
    resolveChatComparison(
      request("Сравни цены", { items: [null, {}, { id: "1" }] }),
      catalog,
    ).ready,
    false,
  );
  assert.equal(
    resolveChatComparison(
      {
        ...request("Сравни цены 027024 и 027228"),
        importItems: [{ query: "027024", quantity: 2 }],
      },
      catalog,
    ),
    null,
  );
});

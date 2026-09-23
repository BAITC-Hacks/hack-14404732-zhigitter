import test from "node:test";
import assert from "node:assert/strict";
import { findPhotoCodeMatches } from "../src/lib/attachments/matching.ts";
import { resolveImportedItems } from "../src/lib/attachments/import-matching.ts";
import { validateRequest } from "../src/lib/assistant/validation.ts";
import {
  fileKind,
  validateExtraction,
} from "../src/lib/attachments/validation.ts";
import {
  csvCell,
  specificationCsv,
  specificationText,
} from "../src/lib/cart/export.ts";
const raw = {
  items: [
    {
      description: "Клемма WAGO",
      marking: " 221-413 ",
      quantity: 1000,
      evidence: "На корпусе 32 A",
      uncertain: false,
    },
  ],
  warning: "",
  ignoredInstructions: false,
  truncated: false,
};
test("Import preserves exact requested SKU and never replaces missing/ambiguous rows", () => {
  const products = [
    {
      id: 1,
      article: "sku1",
      supplierArticle: "027024",
      name: "027024 Legrand АВ",
    },
    {
      id: 2,
      article: "sku2",
      supplierArticle: "027004",
      name: "027004 Legrand АВ",
    },
  ];
  const result = resolveImportedItems(
    [
      { query: "027024", quantity: 2 },
      { query: "QXZ999", quantity: 3 },
      { query: "Legrand", quantity: 1 },
    ],
    products,
  );
  assert.deepEqual(result.items, [{ id: 1, quantity: 2 }]);
  assert.equal(result.notices.length, 2);
  assert.match(result.notices[0], /не найдено/);
  assert.match(result.notices[1], /несколько/);
});
test("Imported request validates each row and retains the original line count", () => {
  const request = {
    city: "Алматы",
    messages: [{ role: "user", content: "Список" }],
    importItems: [
      { query: "027024", quantity: 2 },
      { query: "unknown", quantity: 3 },
    ],
  };
  assert.equal(validateRequest(request, ["Алматы"]).expectedItems, 2);
  assert.equal(
    validateRequest(
      { ...request, importItems: [{ query: "027024", quantity: -1 }] },
      ["Алматы"],
    ),
    null,
  );
});
test("Photo matcher reads dashed supplier codes from index names and separates series", () => {
  const products = [
    { id: 4, article: "d", name: "221-2411 Клемма", supplierArticle: null },
    { id: 2, article: "b", name: "221-413 Клемма", supplierArticle: null },
    { id: 1, article: "a", name: "221-412 Клемма", supplierArticle: null },
    { id: 3, article: "c", name: "221-415 Клемма", supplierArticle: null },
  ];
  assert.deepEqual(
    findPhotoCodeMatches(products, "221-413").exact.map((p) => p.id),
    [2],
  );
  assert.deepEqual(
    findPhotoCodeMatches(products, "221")
      .series.slice(0, 3)
      .map((p) => p.id),
    [1, 2, 3],
  );
  assert.deepEqual(findPhotoCodeMatches(products, "221").exact, []);
});
test("Photo never supplies a purchase quantity, even if model emits one", () => {
  const result = validateExtraction(raw, true);
  assert.equal(result.items[0].quantity, null);
  assert.equal(result.items[0].marking, "221-413");
});
test("Imported quantity must be an explicit bounded positive integer", () => {
  for (const quantity of [-1, 0, 1.5, 100001, "10", null])
    assert.equal(
      validateExtraction(
        { ...raw, items: [{ ...raw.items[0], quantity }] },
        false,
      ).items[0].quantity,
      null,
    );
  assert.equal(
    validateExtraction(
      { ...raw, items: [{ ...raw.items[0], quantity: 10, marking: "027024" }] },
      false,
    ).items[0].marking,
    "027024",
  );
});
test("Overlong extraction is explicitly marked truncated and fields bounded", () => {
  const result = validateExtraction(
    {
      ...raw,
      items: Array(6).fill({ ...raw.items[0], description: "x".repeat(500) }),
    },
    false,
  );
  assert.equal(result.items.length, 4);
  assert.equal(result.truncated, true);
  assert.equal(result.items[0].description.length, 200);
  assert.throws(() =>
    validateExtraction({ items: [{ description: "bad" }] }, false),
  );
});
test("File signatures distinguish actual formats from filename spoofing", () => {
  assert.equal(fileKind(Buffer.from("<svg></svg>"), "photo.jpg"), null);
  assert.equal(fileKind(Buffer.from("%PDF-1.7"), "fake.jpg"), "pdf");
  assert.equal(
    fileKind(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "x"),
    "image",
  );
  assert.equal(fileKind(Buffer.from("027024;10"), "list.csv"), "text");
  assert.equal(fileKind(Buffer.from([0, 1, 2]), "list.txt"), null);
});
test("CSV neutralizes formula injection and escapes quotes/separators/newlines", () => {
  for (const value of ["=HYPERLINK(1)", "+cmd", "-1+2", "@SUM(A1)", " \t=1+1"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('A;"B"\nC'), '"A;""B""\nC"');
  assert.equal(csvCell("027024"), '"027024"');
});
test("Specification uses saved price, flags changed data and excludes delivery", () => {
  const cart = {
    state: { city: "Алматы", confirmedAt: "2026-09-23T10:00:00Z" },
    total: 200,
    items: [
      {
        saved: {
          productId: 1,
          quantity: 2,
          unitPrice: 100,
          sourceCity: null,
          originalId: null,
        },
        product: {
          name: "=Unsafe name",
          article: "027024",
          price: 999,
          url: "https://ekt.kz/catalog/test/",
          fetchedAt: "2026-09-23T10:01:00Z",
        },
        issue: "Цена изменилась",
      },
    ],
  };
  const text = specificationText(cart),
    csv = specificationCsv(cart);
  assert.match(text, /2 ед\. × 100 ₸ = 200 ₸/);
  assert.match(text, /Цена изменилась/);
  assert.match(text, /Заказ и резерв в EKT не созданы/);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes("'=Unsafe name"));
  assert.ok(!csv.includes("999"));
});

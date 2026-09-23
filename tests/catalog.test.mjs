import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDetail,
  normalizeSummary,
  searchProducts,
  cityStock,
  numeric,
  safeUrl,
} from "../src/lib/catalog/normalize.ts";

const timestamp = "2026-09-23T10:00:00.000Z";
const fixture = {
  id: 515291,
  name: "027228 АВ DRX250 MT 3ф 160А 18ka Legrand (1)",
  article: "200300285_",
  price: 64920,
  quantity: 23,
  properties: { ARTIKULPOSTAVSHCHIKA: "027228", NOMINALNYY_TOK: "250 А" },
  description: "Номинальный ток: 160А",
  stores: [
    { id: 1, name: "Алматы", quantity: 5 },
    { id: 2, name: "Нур-Султан", quantity: 8 },
    { id: 3, name: "Шымкент (Тассай)", quantity: 1 },
    { id: 4, name: "Шымкент (ул.Байдукова)", quantity: 2 },
    { id: 5, name: "Брак Алматы", quantity: 100 },
    { id: 6, name: "Образцы Алматы", quantity: 50 },
  ],
};

test("Unknown stock and price never become zero", () => {
  const result = normalizeDetail({ id: 1, name: "Example" }, timestamp);
  assert.equal(result.price, null);
  assert.equal(result.totalQuantity, null);
  assert.equal(cityStock(result, "Алматы"), null);
  assert.equal(numeric(""), null);
  assert.equal(numeric(null), null);
  assert.equal(numeric(false), null);
  assert.equal(numeric(-2), null);
  assert.equal(numeric("0"), 0);
  assert.equal(numeric("1 250,5"), 1250.5);
});
test("Cities aggregate known retail stock, alias Astana, exclude technical stores", () => {
  const result = normalizeDetail(fixture, timestamp);
  assert.equal(cityStock(result, "Алматы"), 5);
  assert.equal(cityStock(result, "Астана"), 8);
  assert.equal(cityStock(result, "Шымкент"), 3);
  assert.equal(result.totalQuantity, 23);
});
test("Missing quantity within city stays unknown", () => {
  const result = normalizeDetail(
    { ...fixture, stores: [{ name: "Алматы" }] },
    timestamp,
  );
  assert.equal(cityStock(result, "Алматы"), null);
});
test("Supplier codes preserve leading zero; articles work with punctuation", () => {
  const result = normalizeSummary(fixture, timestamp);
  assert.equal(result.supplierArticle, "027228");
  for (const query of [
    "027228",
    "200300285_",
    "200300285",
    "Legrand 160 А",
    "027228 Legrand",
  ])
    assert.equal(searchProducts([result], query)[0]?.id, fixture.id, query);
  assert.equal(searchProducts([result], "неттакоготовара").length, 0);
});
test("Description and properties retain discrepancies for later review", () => {
  const result = normalizeDetail(fixture, timestamp);
  assert.equal(result.properties.NOMINALNYY_TOK, "250 А");
  assert.match(result.description, /160А/);
  assert.equal(result.fetchedAt, timestamp);
  assert.match(result.source, /515291$/);
});
test("Only supplied safe image and certificate links are exposed", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("https://other.test/photo.jpg", true), null);
  assert.equal(
    safeUrl("https://secret:password@ekt.kz/upload/a.jpg", true),
    null,
  );
  assert.equal(safeUrl("/upload/a.jpg", true), "https://ekt.kz/upload/a.jpg");
  const result = normalizeDetail(
    {
      ...fixture,
      properties: {
        CERTIFICATE: "Нет",
        CERT_URL: "https://ekt.kz/upload/cert.pdf",
        IMAGE: "/upload/a.jpg",
      },
    },
    timestamp,
  );
  assert.equal(result.certificates.length, 1);
  assert.equal(result.certificates[0].url, "https://ekt.kz/upload/cert.pdf");
  assert.deepEqual(normalizeDetail(fixture, timestamp).certificates, []);
});

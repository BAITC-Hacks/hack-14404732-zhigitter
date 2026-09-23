import test from "node:test";
import assert from "node:assert/strict";
import { getClarification } from "../src/lib/assistant/clarification.ts";
import { comparePrices } from "../src/lib/assistant/price-comparison.ts";
import { normalizeDetail } from "../src/lib/catalog/normalize.ts";
const catalog = [
  {
    id: 1,
    article: "200300277_",
    supplierArticle: "027024",
    name: "027024 АВ 3ф 40А",
  },
  {
    id: 2,
    article: "030300113_",
    supplierArticle: null,
    name: "221-413 Клемма 3-проводная",
  },
];
const req = (text, before = []) => ({
  city: "Алматы",
  messages: [...before, { role: "user", content: text }],
});
const pending = {
  role: "assistant",
  content: JSON.stringify({ clarification: true }),
};
test("Vague breaker asks for current and poles without selecting a default", () => {
  const result = getClarification(
    req("Мне нужен автомат для квартиры"),
    catalog,
  );
  assert.match(result.text, /ток/);
  assert.match(result.text, /полюсов/);
});
test("Exact supplier/internal/dashed code bypasses unnecessary questions", () => {
  for (const text of ["Автомат 027024 10 шт", "200300277_", "Клемма 221-413"])
    assert.equal(getClarification(req(text), catalog), null, text);
});
test("A short follow-up fills the missing slots", () => {
  const history = [{ role: "user", content: "Нужен автомат" }, pending];
  assert.equal(
    getClarification(req("40 А, 3P, 10 штук", history), catalog),
    null,
  );
  const partial = getClarification(req("40 А", history), catalog);
  assert.match(partial.text, /полюсов/);
  assert.doesNotMatch(partial.text, /Какой номинальный/);
});
test("A new vague product does not inherit specifications from a prior product", () => {
  const result = getClarification(
    req("А теперь нужен автомат", [
      { role: "user", content: "автомат 40А 3P" },
      { role: "assistant", content: "Товар найден" },
    ]),
    catalog,
  );
  assert.match(result.text, /номинальный ток/);
});
test("Repeating the device name in a follow-up keeps previously supplied poles", () => {
  assert.equal(
    getClarification(
      req("автомат 40А", [
        { role: "user", content: "Нужен автомат 3P" },
        pending,
      ]),
      catalog,
    ),
    null,
  );
});
test("RCBO leakage is not mistaken for rated current; quantity is not current", () => {
  const result = getClarification(req("Дифавтомат 30мА 10 штук"), catalog);
  assert.match(result.text, /номинальный ток/);
  assert.equal(
    getClarification(req("Дифавтомат 16А 1P+N 30мА"), catalog),
    null,
  );
});
test("Terminal conductor question accepts follow-up; unknown parameters offers photo", () => {
  const history = [{ role: "user", content: "Нужна клемма" }, pending];
  assert.equal(
    getClarification(req("На 3 проводника", history), catalog),
    null,
  );
  assert.match(
    getClarification(req("Не знаю", history), catalog).text,
    /По фото/,
  );
});
test("Delivery, imported files, and unrelated follow-ups do not enter clarification loop", () => {
  assert.equal(
    getClarification(
      req("Какая доставка?", [{ role: "user", content: "автомат" }, pending]),
      catalog,
    ),
    null,
  );
  assert.equal(
    getClarification(
      { ...req("клеммы"), importItems: [{ query: "221-413", quantity: 2 }] },
      catalog,
    ),
    null,
  );
  assert.equal(getClarification(req("40А"), catalog), null);
});
test("Kazakh vague query gets a Kazakh clarification", () => {
  const result = getClarification(req("Маған автомат керек"), catalog);
  assert.equal(result.language, "kk");
  assert.match(result.text, /Номиналды/);
});
const p = (id, price, unit) =>
  normalizeDetail({ id, name: "Товар", price, unit }, "2026-09-23T12:00:00Z");
test("Compare same-unit prices without claiming electrical compatibility", () => {
  const result = comparePrices(p(1, 100, "шт."), p(2, 160, "шт"));
  assert.equal(result.difference, 60);
  assert.equal(result.cheaperId, 1);
  assert.equal(result.sameUnit, true);
  assert.match(result.note, /не подтверждает совместимость/);
});
test("Unknown price stays unknown and zero price is valid", () => {
  assert.equal(
    comparePrices(p(1, null, "шт"), p(2, 160, "шт")).difference,
    null,
  );
  assert.equal(comparePrices(p(1, 0, "шт"), p(2, 160, "шт")).difference, 160);
  assert.equal(comparePrices(p(1, 100, "шт"), p(2, 100, "шт")).cheaperId, null);
});
test("Missing or differing sale units never imply comparable quantity savings", () => {
  assert.equal(comparePrices(p(1, 100, null), p(2, 160, null)).sameUnit, false);
  assert.match(
    comparePrices(p(1, 100, "м"), p(2, 160, "бухта")).note,
    /Разные единицы/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { structuredResponse } from "../src/lib/assistant/responses.ts";
import { directSelection } from "../src/lib/assistant/direct-selection.ts";
import { extractOfficeText } from "../src/lib/attachments/office.ts";
import { normalizeDetail } from "../src/lib/catalog/normalize.ts";
import {
  resolveSalesHelp,
  salesHelpResult,
} from "../src/lib/assistant/sales-help.ts";
import { validateRequest } from "../src/lib/assistant/validation.ts";
import { evaluateSelections } from "../src/lib/cart/core.ts";
const completed = (value) =>
  Response.json({
    status: "completed",
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(value) }] },
    ],
  });
test("Incomplete output is discarded, retried once with larger budget, then validated", async () => {
  const calls = [];
  const result = await structuredResponse({
    key: "test",
    body: { model: "gpt-4.1-mini" },
    validate: (v) => v,
    fetcher: async (_, options) => {
      calls.push(JSON.parse(options.body));
      return calls.length === 1
        ? Response.json({
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output: [
              { content: [{ type: "output_text", text: '{"id":999}' }] },
            ],
          })
        : completed({ id: 1 });
    },
  });
  assert.deepEqual(result, { id: 1 });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].max_output_tokens > calls[0].max_output_tokens);
  assert.equal(calls[0].store, false);
});
test("Temporary upstream error recovers; invalid JSON cannot escape validation", async () => {
  let calls = 0;
  assert.equal(
    await structuredResponse({
      key: "test",
      body: {},
      validate: (v) => v.ok,
      fetcher: async () =>
        ++calls === 1
          ? new Response("", { status: 503 })
          : completed({ ok: true }),
    }),
    true,
  );
  calls = 0;
  await assert.rejects(
    structuredResponse({
      key: "test",
      body: {},
      validate: () => {
        throw Error("invalid schema");
      },
      fetcher: async () => {
        calls++;
        return completed({});
      },
    }),
    /повторной попытки/,
  );
  assert.equal(calls, 2);
});
test("Refusal, content filter, quota and authentication errors are not retried", async () => {
  for (const response of [
    () =>
      Response.json({
        status: "completed",
        output: [{ content: [{ type: "refusal" }] }],
      }),
    () =>
      Response.json({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
      }),
    () => new Response("", { status: 429 }),
    () => new Response("", { status: 401 }),
  ]) {
    let calls = 0;
    await assert.rejects(
      structuredResponse({
        key: "test",
        body: {},
        validate: (v) => v,
        fetcher: async () => {
          calls++;
          return response();
        },
      }),
    );
    assert.equal(calls, 1);
  }
});
test("User cancellation stops before sending/retrying", async () => {
  const c = new AbortController();
  c.abort();
  let calls = 0;
  await assert.rejects(
    structuredResponse({
      key: "test",
      body: {},
      signal: c.signal,
      validate: (v) => v,
      fetcher: async () => {
        calls++;
        return completed({});
      },
    }),
  );
  assert.equal(calls, 0);
});
const catalog = [
  {
    id: 515283,
    article: "200300277_",
    supplierArticle: "027024",
    name: "027024 АВ 40А",
  },
  {
    id: 48783,
    article: "030300113_",
    supplierArticle: null,
    name: "221-413 Клемма",
  },
];
const req = (content) => ({
  city: "Алматы",
  messages: [{ role: "user", content }],
});
test("Sales help preserves selected product context and rejects invalid quantities", () => {
  const request = {
    ...req("Дорого"),
    messages: [
      {
        role: "assistant",
        content: JSON.stringify({ items: [{ id: 515283, quantity: 2 }] }),
      },
      { role: "user", content: "Дорого" },
    ],
  };
  assert.deepEqual(resolveSalesHelp(request, catalog), {
    kind: "budget",
    productId: 515283,
    quantity: 2,
  });
  assert.equal(
    validateRequest(
      {
        ...req("Помоги"),
        salesHelp: { kind: "urgent", productId: 515283, quantity: -1 },
      },
      ["Алматы"],
    ),
    null,
  );
  assert.equal(
    resolveSalesHelp(
      {
        ...req("Дорого"),
        salesHelp: { kind: "budget", productId: 999, quantity: 2 },
      },
      catalog,
    ),
    null,
  );
});
test("Approval draft uses catalog prices and never claims a sent message or placed order", () => {
  const product = normalizeDetail(
    {
      id: 1,
      name: "Test",
      article: "SKU",
      price: 100,
      quantity: 5,
      stores: [{ id: 13, name: "Алматы", quantity: 5 }],
    },
    "2026-09-23",
  );
  const result = salesHelpResult(
    { kind: "approval", productId: 1, quantity: 2 },
    [
      {
        product,
        localStock: 5,
        requestedQuantity: 2,
        conflicts: [],
        comparison: null,
      },
    ],
    "Алматы",
  );
  assert.match(result.draft, /200 ₸/);
  assert.match(result.draft, /резерв не созданы/);
});
test("Cart enforces supplier sale multiple before confirmation", () => {
  const product = normalizeDetail(
    {
      id: 1,
      name: "Клемма",
      article: "SKU",
      price: 100,
      quantity: 50,
      properties: { KRATNOST_MIN: "5" },
      stores: [{ id: 13, name: "Алматы", quantity: 50 }],
    },
    "2026-09-23",
  );
  const selection = {
    productId: 1,
    quantity: 2,
    sourceCity: null,
    originalId: null,
  };
  assert.throws(
    () => evaluateSelections([selection], "Алматы", new Map([[1, product]])),
    /кратность/,
  );
  assert.equal(
    evaluateSelections(
      [{ ...selection, quantity: 5 }],
      "Алматы",
      new Map([[1, product]]),
    ).total,
    500,
  );
});
test("Exact supplier code handles the failed production query without a model", () => {
  const p = directSelection(req("Нужны 2 штуки 027024 в Алматы"), catalog, [
    "Алматы",
  ]);
  assert.deepEqual(p.items, [{ id: 515283, quantity: 2 }]);
  assert.equal(
    directSelection(req("027024"), catalog, ["Алматы"]).items[0].quantity,
    null,
  );
  assert.equal(
    directSelection(req("Клемма 221-413 3 шт"), catalog, ["Алматы"]).items[0]
      .id,
    48783,
  );
  assert.equal(
    directSelection(req("027024 2 шт; 221-413 3 шт"), catalog, ["Алматы"]),
    null,
  );
});
test("Purchase terms work without a model and quantities never come from nominal", () => {
  const p = directSelection(
    req("Оплата, доставка, минимальная партия?"),
    catalog,
    ["Алматы"],
  );
  assert.deepEqual(p.topics, ["payment", "delivery", "minimum"]);
  assert.equal(
    directSelection(req("Автомат 027024 40А"), catalog, ["Алматы"]).items[0]
      .quantity,
    null,
  );
});
test("DOCX and XLSX preserve leading-zero articles and table quantities", async () => {
  for (const kind of ["docx", "xlsx"]) {
    const text = await extractOfficeText(
      await fs.readFile(new URL(`./fixtures/order.${kind}`, import.meta.url)),
      kind,
    );
    assert.match(text, /027024\s+2/);
    assert.match(text, /221-413\s+3/);
  }
});
test("Office rejects formulas, entity declarations and excessive decompression", async () => {
  for (const [name, kind] of [
    ["formula.xlsx", "xlsx"],
    ["entity.docx", "docx"],
    ["oversized.docx", "docx"],
  ])
    await assert.rejects(
      extractOfficeText(
        await fs.readFile(new URL(`./fixtures/${name}`, import.meta.url)),
        kind,
      ),
    );
  await assert.rejects(extractOfficeText(Buffer.from("not a zip"), "docx"));
});
test("Certificate is shown only from supplied certificate field, absent remains absent", () => {
  const p = normalizeDetail(
    {
      id: 1,
      name: "test",
      certificates: [{ url: "https://ekt.kz/upload/certificate.pdf" }],
    },
    "2026-09-23",
  );
  assert.equal(p.certificates[0].url, "https://ekt.kz/upload/certificate.pdf");
  assert.deepEqual(
    normalizeDetail({ id: 1, name: "test" }, "2026-09-23").certificates,
    [],
  );
});

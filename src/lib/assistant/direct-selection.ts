import type { ChatRequest, Selection } from "./types";
import type { ProductSummary } from "../catalog/types";
// Common exact-SKU and purchase-term requests do not need probabilistic parsing.
export function directSelection(
  request: ChatRequest,
  catalog: ProductSummary[],
  cities: readonly string[],
): Selection | null {
  const text = request.messages.at(-1)!.content;
  const topics: Selection["topics"] = [];
  if (/оплат|плат[её]ж|төле/i.test(text)) topics.push("payment");
  if (/достав|жеткіз/i.test(text)) topics.push("delivery");
  if (/минимальн|кратност|ең аз/i.test(text)) topics.push("minimum");
  const tokens = new Set(text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || []);
  const matches = catalog.filter((p) =>
    [
      p.article,
      p.supplierArticle,
      p.name.match(/^\s*([\d][\d-]{3,})/)?.[1],
    ].some((code) => code && tokens.has(code.toLowerCase())),
  );
  const quantities = [
    ...text.matchAll(
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:штук[аи]?|шт\.?|ед\.?|дана|pcs)(?![\p{L}])/giu,
    ),
  ].map((m) => Number(m[1].replace(",", ".")));
  // More than one code/quantity, ranges and compound lists go through validated AI parsing.
  if (
    matches.length > 1 ||
    quantities.length > 1 ||
    /\n|;|(?:^|\s)\d+\s*[-–]\s*\d+\s*(?:шт|ед|дана)/i.test(text)
  )
    return null;
  if (
    !matches.length &&
    (!topics.length || /артикул|автомат|клемм|аналог|\d/i.test(text))
  )
    return null;
  if (quantities.some((q) => !Number.isSafeInteger(q) || q < 1 || q > 100000))
    return null;
  const kk =
    !/на русском|по-русски/i.test(text) &&
    /[әғқңөұүһі]|керек|бар ма/i.test(text);
  return {
    intent: !matches.length
      ? "terms"
      : /добав|корзин|себет/i.test(text)
        ? "cart"
        : /аналог|замен|подешев|дешевле/i.test(text)
          ? "alternative"
          : "product",
    language: kk ? "kk" : "ru",
    city:
      cities.find((c) => text.toLowerCase().includes(c.toLowerCase())) ||
      (/Нур-Султан/i.test(text) ? "Астана" : null),
    items: matches.map((p) => ({ id: p.id, quantity: quantities[0] ?? null })),
    alternativeIds: [],
    question: "",
    topics,
  };
}

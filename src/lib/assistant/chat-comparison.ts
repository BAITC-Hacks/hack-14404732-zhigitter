import type { ChatRequest } from "./types";
import type { ProductSummary } from "../catalog/types";

// Prices and product IDs always come from the catalog, never from chat history.
export function resolveChatComparison(
  request: ChatRequest,
  catalog: ProductSummary[],
) {
  if (request.importItems || request.salesHelp) return null;
  const text = request.messages.at(-1)!.content;
  let previous: {
    priceComparison?: boolean;
    clarification?: boolean;
    items?: { id: number }[];
  } = {};
  const last = request.messages.at(-2);
  if (last?.role === "assistant") {
    try {
      previous = JSON.parse(last.content) || {};
    } catch {
      /* Plain prose has no product context. */
    }
  }
  const explicit =
    /сравн|сопостав|что дешевле|какой дешевле|который дешевле|разниц[ауые].*цен|баға.*салыстыр|салыстыр.*баға/i.test(
      text,
    );
  const tokens: string[] = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
  const codes = catalog.flatMap(
    (p) =>
      [
        p.article,
        p.supplierArticle,
        p.name.match(/^\s*([\d][\d-]{3,})/)?.[1],
      ].filter(Boolean) as string[],
  );
  const ids = catalog
    .filter((p) =>
      [
        p.article,
        p.supplierArticle,
        p.name.match(/^\s*([\d][\d-]{3,})/)?.[1],
      ].some((c) => c && tokens.includes(c.toLowerCase())),
    )
    .map((p) => p.id);
  if (
    !explicit &&
    !(previous.priceComparison && previous.clarification && ids.length)
  )
    return null;
  const kk =
    /[әғқңөұүһі]|салыстыр/i.test(text) && !/на русском|по-русски/i.test(text);
  const unknownCode = tokens.some(
    (t) =>
      /^\d[\d_-]{3,}$/.test(t) && !codes.some((c) => c.toLowerCase() === t),
  );
  const priorIds = Array.isArray(previous.items)
    ? [
        ...new Set(
          previous.items
            .filter((item) => item && catalog.some((p) => p.id === item.id))
            .map((item) => item.id),
        ),
      ]
    : [];
  let selected = ids;
  if (!unknownCode && !ids.length && explicit) selected = priorIds;
  if (!unknownCode && ids.length === 1 && priorIds.length === 1)
    selected = [...new Set([...priorIds, ...ids])];
  const ready = !unknownCode && selected.length === 2;
  return {
    ids: ready ? selected : ids.length === 1 && !unknownCode ? ids : [],
    ready,
    language: kk ? ("kk" as const) : ("ru" as const),
    question: kk
      ? "Салыстыру үшін екі тауардың артикулын жазыңыз. Мысалы: 027024 және 027228."
      : unknownCode
        ? "Один из артикулов не найден в нашей выборке. Укажите два артикула из каталога — сравню их цены."
        : selected.length > 2
          ? "В ответе больше двух товаров. Укажите, какие два артикула сравнить по цене."
          : "Укажите второй артикул или сразу два товара. Например: «Сравни цены 027024 и 027228».",
  };
}

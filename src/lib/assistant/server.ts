import "server-only";
import { randomUUID } from "node:crypto";
import { getProduct, getCatalogIndex } from "../catalog/server";
import { cityStock, normalizeDetail } from "../catalog/normalize";
import { compareProducts, detectConflicts, saleStock } from "./facts";
import { selectProducts } from "./openai";
import { purchaseTerms } from "./terms";
import { resolveImportedItems } from "../attachments/import-matching";
import { getClarification } from "./clarification";
import { cities } from "./types";
import type {
  AssistantCard,
  AssistantReply,
  ChatRequest,
  Selection,
} from "./types";

export async function answerRequest(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<AssistantReply> {
  const started = Date.now();
  const clarification = getClarification(request, getCatalogIndex());
  if (clarification) {
    const latest = request.messages.at(-1)!.content;
    const city =
      cities.find((c) => latest.toLowerCase().includes(c.toLowerCase())) ||
      request.city;
    return {
      ...clarification,
      clarification: true,
      id: randomUUID(),
      city,
      cards: [],
      notices: [],
      terms: [],
      cartChanged: false,
      elapsedMs: Date.now() - started,
    };
  }
  const imported = request.importItems
    ? resolveImportedItems(request.importItems, getCatalogIndex())
    : null;
  const plan: Selection = imported
    ? {
        intent: "product",
        language: "ru",
        city: null,
        items: imported.items,
        alternativeIds: [],
        question: "",
        topics: [],
      }
    : await selectProducts(request, signal);
  const latest = request.messages.at(-1)!.content;
  if (
    !/на русском|по-русски/i.test(latest) &&
    /[әғқңөұүһі]|бар\s+ма|керек|тауар|қазақ/i.test(latest)
  )
    plan.language = "kk";
  // Deterministic candidates back up model retrieval using only catalog IDs and visible specifications.
  const catalog = getCatalogIndex();
  const first = catalog.find((p) => p.id === plan.items[0]?.id);
  if (first) {
    const original = normalizeDetail(first, first.fetchedAt);
    const fallback = catalog
      .filter((p) => !plan.items.some((item) => item.id === p.id))
      .map((p) => ({
        id: p.id,
        comparison: compareProducts(original, normalizeDetail(p, p.fetchedAt)),
      }))
      .filter((item) => item.comparison)
      .sort(
        (a, b) => b.comparison!.matches.length - a.comparison!.matches.length,
      )
      .map((item) => item.id);
    plan.alternativeIds = [
      ...new Set([...plan.alternativeIds, ...fallback]),
    ].slice(0, 3);
  }
  const kk = plan.language === "kk",
    city = plan.city || request.city;
  const notices: string[] = imported?.notices || [],
    cards: AssistantCard[] = [];
  // Fetch all candidates concurrently, then decide which alternatives to display using actual stock.
  const ids = [
    ...new Set([...plan.items.map((item) => item.id), ...plan.alternativeIds]),
  ];
  const results = await Promise.allSettled(ids.map((id) => getProduct(id)));
  const products = new Map(
    results.flatMap((result, index) =>
      result.status === "fulfilled"
        ? [[ids[index], result.value] as const]
        : [],
    ),
  );
  for (const item of plan.items) {
    const product = products.get(item.id);
    if (!product) {
      notices.push(
        kk
          ? `ID ${item.id}: каталог деректерін жаңарту мүмкін болмады.`
          : `Товар ID ${item.id}: не удалось обновить данные поставщика. Повторите запрос.`,
      );
      continue;
    }
    cards.push({
      product,
      requestedQuantity: item.quantity,
      localStock: cityStock(product, city),
      conflicts: detectConflicts(product),
      comparison: null,
    });
  }
  const original = cards[0];
  if (request.expectedItems && cards.length < request.expectedItems)
    notices.push(
      `В списке ${request.expectedItems} строк; найдено ${cards.length} отдельных товаров. Остальные строки не подтверждены (повторяющиеся товары могли объединиться). Проверьте сопоставление перед добавлением.`,
    );
  const needAlternatives =
    original &&
    (plan.intent === "alternative" ||
      saleStock(original.product) === 0 ||
      (original.requestedQuantity !== null &&
        original.localStock !== null &&
        original.localStock < original.requestedQuantity));
  if (needAlternatives) {
    for (const id of plan.alternativeIds) {
      const candidate = products.get(id);
      if (!candidate || !(saleStock(candidate)! > 0)) continue;
      const comparison = compareProducts(original.product, candidate);
      if (!comparison) continue;
      cards.push({
        product: candidate,
        localStock: cityStock(candidate, city),
        requestedQuantity: null,
        conflicts: detectConflicts(candidate),
        comparison,
      });
    }
    if (!cards.some((card) => card.comparison))
      notices.push(
        kk
          ? "Осы 200 тауардың ішінен қолжетімді балама расталмады. Бұл толық каталог емес."
          : "В выборке из 200 товаров не удалось подтвердить доступного кандидата на замену. Это не весь каталог EKT.",
      );
  }
  let text = cards.length
    ? kk
      ? "Каталогтан табылған тауарлар төменде. Баға мен қалдық EKT деректерінен алынды."
      : "Нашёл товары в каталоге. Ниже — цены, характеристики и остатки из данных EKT."
    : kk
      ? "Бұл таңдамада нақты тауарды анықтай алмадым. Артикулын немесе түрі мен негізгі параметрлерін жазыңыз."
      : "Не удалось однозначно подобрать товар в этой выборке. Укажите артикул или тип и основные параметры.";
  if (plan.intent === "terms")
    text = kk
      ? "EKT сайтындағы сатып алу шарттары:"
      : "Вот условия покупки, опубликованные на сайте EKT:";
  if (plan.intent === "clarify" && !cards.length)
    text = kk
      ? "Электр тауарларын таңдауға көмектесемін. Қандай тауар және қанша дана қажет?"
      : "Помогу найти электротехнику, проверить наличие и сравнить варианты. Что нужно купить и в каком количестве?";
  if (plan.intent === "cart")
    text = kk
      ? "Тауар себетке автоматты түрде қосылған жоқ. «Ваш комплект» панелінде нұсқаны таңдап, «Проверить и добавить» түймесін басыңыз және себет құрамын растаңыз."
      : "В корзину ничего не добавлено автоматически. Выберите вариант в панели «Ваш комплект», нажмите «Проверить и добавить» и подтвердите состав.";
  if (cards.some((card) => card.conflicts.length))
    notices.push(
      kk
        ? "Жеткізуші деректерінде қайшылық бар. Расталғанша бұл тауар бойынша номиналды таңдауға болмайды."
        : "Обнаружено противоречие в данных поставщика. До проверки нельзя подтвердить номинал и совместимость этого товара.",
    );
  if (cards.some((card) => card.comparison))
    text += kk
      ? " Балама үміткерлердің сәйкестіктері мен айырмашылықтары бөлек көрсетілген."
      : " Для кандидатов на замену отдельно показал совпадения, различия и непроверенные параметры.";
  if (
    plan.question &&
    /[?？]/.test(plan.question) &&
    !cards.length &&
    plan.intent !== "terms" &&
    plan.intent !== "cart"
  )
    text += "\n\n" + plan.question;
  const suggestions =
    plan.language === "kk"
      ? ["Жеткізу шарттары қандай?", "Қалай төлеуге болады?"]
      : ["Какие условия доставки?", "Как оплатить юрлицу?"];
  if (original)
    suggestions.unshift(
      kk
        ? `${original.product.article} тауарын Астанадан тексер`
        : `Проверь ${original.product.article} в Астане`,
    );
  return {
    ...(request.expectedItems
      ? { requestedLineCount: request.expectedItems }
      : {}),
    id: randomUUID(),
    text,
    language: plan.language,
    city,
    cards,
    notices,
    terms: purchaseTerms(
      plan.topics.length
        ? plan.topics
        : plan.intent === "terms"
          ? ["payment", "delivery", "minimum"]
          : [],
      plan.language,
    ),
    suggestions,
    cartChanged: false,
    elapsedMs: Date.now() - started,
  };
}

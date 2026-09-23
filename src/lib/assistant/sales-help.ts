import type {
  AssistantCard,
  AssistantReply,
  ChatRequest,
  SalesHelp,
} from "./types";
import type { ProductSummary } from "../catalog/types";
export function resolveSalesHelp(
  request: ChatRequest,
  catalog: ProductSummary[],
): SalesHelp | null {
  if (request.importItems) return null;
  if (request.salesHelp)
    return catalog.some((p) => p.id === request.salesHelp!.productId)
      ? request.salesHelp
      : null;
  const text = request.messages.at(-1)!.content;
  const kind = /дорого|подешевле|дешевле|қымбат/i.test(text)
    ? "budget"
    : /срочно|сегодня|тез керек/i.test(text)
      ? "urgent"
      : /согласовать|начальник|руководител/i.test(text)
        ? "approval"
        : /не уверен|совместим|подойд[её]т/i.test(text)
          ? "compatibility"
          : null;
  if (!kind) return null;
  // Explicit product requests are parsed normally, rather than reusing a different prior item.
  if (/\d{4,}|артикул/i.test(text)) return null;
  for (const m of request.messages.slice(0, -1).reverse()) {
    if (m.role !== "assistant") continue;
    try {
      const body = JSON.parse(m.content);
      const item = Array.isArray(body.items)
        ? body.items.find(
            (i: { alternativeFor?: number; id?: number }) =>
              !i.alternativeFor && catalog.some((p) => p.id === i.id),
          )
        : null;
      if (item)
        return {
          kind,
          productId: item.id,
          quantity:
            Number.isSafeInteger(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 100000
              ? item.quantity
              : null,
        };
    } catch {
      /* Ordinary assistant prose is not item context. */
    }
  }
  return null;
}
export function salesHelpResult(
  help: SalesHelp,
  cards: AssistantCard[],
  city: string,
): NonNullable<AssistantReply["salesHelp"]> {
  const card = cards.find((c) => !c.comparison),
    product = card?.product;
  if (!product)
    return {
      kind: help.kind,
      title: "Нужно обновить товар",
      summary:
        "Данные поставщика недоступны. Повторите запрос по артикулу; корзина не изменена.",
    };
  const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₸`;
  if (help.kind === "budget") {
    const count = cards.filter((c) => c.comparison).length;
    return {
      kind: help.kind,
      title: "Проверим варианты по цене",
      summary: count
        ? `Нашёл ${count} кандидата с более низкой ценой в API. Сравните характеристики и единицы продажи перед выбором; совместимость полностью не подтверждена. Скидка не обещана.`
        : "В текущей выборке не подтвердился более дешёвый доступный кандидат с совпадающими ключевыми параметрами. Укажите бюджет и допустимые характеристики — расширим запрос. Скидки и замены номинала не выдумываю.",
    };
  }
  if (help.kind === "urgent")
    return {
      kind: help.kind,
      title: "Что доступно в вашем городе",
      summary: `${city}: ${card.localStock === null ? "остаток неизвестен" : `${card.localStock} ед. по API`}.${help.quantity ? ` Нужно ${help.quantity}.` : " Укажите нужное количество."} Выберите местный вариант в «Ваш комплект». Наличие не гарантирует получение сегодня: время готовности и самовывоз подтвердите у EKT.`,
    };
  const lines = [
    `Запрос по товару: ${product.name}`,
    `Артикул: ${product.article}`,
    `Город: ${city}`,
    `Количество: ${help.quantity ?? "нужно уточнить"}`,
    `Цена API: ${product.price === null ? "не указана" : money(product.price)}`,
    `Сумма товаров: ${help.quantity && product.price !== null ? money(help.quantity * product.price) : "не рассчитана"}; без доставки.`,
    `В городе: ${card.localStock ?? "нет данных"}`,
    `Источник: ${product.url || product.source}`,
    `Данные: ${product.fetchedAt}`,
    ...card.conflicts.map(
      (c) => `Расхождение: ${c.nameValue}; ${c.propertyValue}.`,
    ),
    help.kind === "compatibility"
      ? "Пожалуйста, подтвердите совместимость с моей установкой, номинал, монтаж, сертификат и условия поставки. Параметры установки: [заполнить]."
      : "Прошу согласовать закупку. Нужно подтвердить срок, стоимость доставки, единицу продажи и применимость товара.",
    "Это предварительный расчёт; заказ и резерв не созданы.",
  ];
  return {
    kind: help.kind,
    title:
      help.kind === "approval"
        ? "Готово для согласования"
        : "Уточним совместимость",
    summary:
      help.kind === "approval"
        ? "Подготовил текст с ценой, количеством и источником. Скопируйте и передайте руководителю. Перед добавлением проверим цену и остатки повторно."
        : "Подготовил вопрос менеджеру с артикулом и найденными расхождениями. Заполните параметры установки. Сообщение никому автоматически не отправляется.",
    draft: lines.join("\n"),
  };
}

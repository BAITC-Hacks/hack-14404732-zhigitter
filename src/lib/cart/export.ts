import type { CartView } from "./types";
const currency = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₸`;
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })
    : "не подтверждено";
export function specificationText(cart: CartView): string {
  return [
    `СПЕЦИФИКАЦИЯ · Комплект AI`,
    `Город: ${cart.state.city}`,
    `Подтверждено: ${date(cart.state.confirmedAt)} (Алматы)`,
    "Цены на момент подтверждения, доставка не включена.",
    "",
    ...cart.items.flatMap(({ saved, product, issue }, index) => [
      `${index + 1}. ${product?.name || `Товар ID ${saved.productId}`}`,
      `Артикул: ${product?.article || "неизвестен"} · ${saved.quantity} ед. × ${currency(saved.unitPrice)} = ${currency(saved.quantity * saved.unitPrice)}`,
      `Склады: ${saved.sourceCity || "несколько городов"}${saved.originalId ? ` · кандидат на замену ID ${saved.originalId}, совместимость проверить` : ""}`,
      `Источник: ${product?.url || "API EKT; карточка сейчас недоступна"}${product ? ` · данные ${date(product.fetchedAt)} (Алматы)` : ""}`,
      ...(issue ? [`Внимание: ${issue}`] : []),
      "",
    ]),
    `ИТОГО: ${currency(cart.total)}`,
    "Корзина прототипа. Заказ и резерв в EKT не созданы. Доставку и совместимость замен согласуйте с поставщиком.",
  ].join("\n");
}
export function csvCell(value: string | number): string {
  const text = String(value); // Neutralize spreadsheet formula interpretation, including whitespace prefixes.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function specificationCsv(cart: CartView): string {
  const rows: (string | number)[][] = [
    [
      "Артикул",
      "Наименование",
      "Количество",
      "Цена KZT (подтверждена)",
      "Сумма KZT",
      "Город закупки",
      "Склады",
      "Статус замены",
      "Источник",
      "Данные API (Алматы)",
      "Предупреждение",
    ],
    ...cart.items.map(({ saved, product, issue }) => [
      product?.article || `ID ${saved.productId}`,
      product?.name || "Название недоступно",
      saved.quantity,
      saved.unitPrice,
      saved.quantity * saved.unitPrice,
      cart.state.city,
      saved.sourceCity || "Несколько городов",
      saved.originalId
        ? `Кандидат вместо ID ${saved.originalId}; проверить совместимость`
        : "Исходный товар",
      product?.url || "API EKT",
      product ? date(product.fetchedAt) : "Недоступно",
      issue || "",
    ]),
    ["", "ИТОГО без доставки", "", "", cart.total],
    ["", "Подтверждено (Алматы)", date(cart.state.confirmedAt)],
    ["", "Корзина прототипа; заказ и резерв в EKT не созданы."],
  ];
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

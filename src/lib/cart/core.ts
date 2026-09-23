import type { ProductDetail } from "../catalog/types";
import { compareProducts, detectConflicts } from "../assistant/facts.ts";
import type { Allocation, CartSelection, QuoteLine } from "./types";

export class CartError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function validSelections(
  value: unknown,
  allowedCities: readonly string[],
): CartSelection[] {
  if (!Array.isArray(value) || value.length > 12)
    throw new CartError(400, "В корзине прототипа допускается до 12 строк.");
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !Number.isSafeInteger(item.productId) ||
      item.productId < 1 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100000 ||
      !(item.sourceCity === null || allowedCities.includes(item.sourceCity)) ||
      !(
        item.originalId === null ||
        (Number.isSafeInteger(item.originalId) && item.originalId > 0)
      )
    )
      throw new CartError(
        400,
        "Проверьте товар, город склада и количество (целое число от 1 до 100 000).",
      );
    return {
      productId: item.productId,
      quantity: item.quantity,
      sourceCity: item.sourceCity,
      originalId: item.originalId,
    };
  });
}
export function mergeSelections(items: CartSelection[]): CartSelection[] {
  const combined = new Map<string, CartSelection>();
  for (const item of items) {
    const key = `${item.productId}:${item.sourceCity}:${item.originalId}`;
    const prior = combined.get(key);
    combined.set(key, {
      ...item,
      quantity: (prior?.quantity || 0) + item.quantity,
    });
  }
  if (combined.size > 12)
    throw new CartError(400, "Корзина прототипа ограничена 12 строками.");
  const result = [...combined.values()];
  if (result.some((item) => item.quantity > 100000))
    throw new CartError(
      400,
      "Количество одной позиции не может превышать 100 000.",
    );
  return result;
}
export function evaluateSelections(
  items: CartSelection[],
  city: string,
  products: Map<number, ProductDetail>,
): { lines: QuoteLine[]; warnings: string[]; total: number } {
  const remaining = new Map<string, number>();
  const warnings = new Set<string>(),
    lines: QuoteLine[] = [];
  // Explicit warehouse choices get allocated first to avoid consuming their stock for a general request.
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Number(!!b.item.sourceCity) - Number(!!a.item.sourceCity));
  const evaluated = new Map<number, QuoteLine>();
  for (const { item, index } of ordered) {
    const product = products.get(item.productId);
    if (!product)
      throw new CartError(
        502,
        `Не удалось обновить товар ID ${item.productId}. Корзина не изменена.`,
      );
    if (detectConflicts(product).length)
      throw new CartError(
        409,
        `${product.article}: противоречие в характеристиках. Нужна проверка поставщика.`,
      );
    if (product.price === null || product.price <= 0)
      throw new CartError(
        409,
        `${product.article}: цена для заказа не подтверждена.`,
      );
    if (item.originalId) {
      const original = products.get(item.originalId),
        comparison = original ? compareProducts(original, product) : null;
      if (!comparison || comparison.blocked)
        throw new CartError(
          409,
          `${product.article}: совместимость замены не подтверждена.`,
        );
      warnings.add(
        `Замена ${original!.article} → ${product.article}. Совпадает: ${comparison.matches.join("; ")}. Различается: ${comparison.differences.join("; ") || "в доступных полях различий не найдено"}. Проверить: ${comparison.unknowns.join("; ")}.`,
      );
    }
    const stores = product.stores
      .filter(
        (s) =>
          !s.excluded &&
          s.city &&
          s.quantity !== null &&
          s.quantity > 0 &&
          (!item.sourceCity || s.city === item.sourceCity),
      )
      .sort(
        (a, b) =>
          Number(b.city === city) - Number(a.city === city) ||
          (b.quantity || 0) - (a.quantity || 0),
      );
    const allocations: Allocation[] = [];
    let needed = item.quantity;
    for (const store of stores) {
      const key = `${product.id}:${store.id}`;
      const available = remaining.get(key) ?? store.quantity!;
      const take = Math.min(needed, Math.floor(available));
      if (take > 0) {
        allocations.push({
          storeId: store.id,
          storeName: store.name,
          city: store.city!,
          quantity: take,
        });
        remaining.set(key, available - take);
        needed -= take;
      }
      if (needed === 0) break;
    }
    if (needed > 0)
      throw new CartError(
        409,
        `${product.article}: для выбранных складов не хватает ${needed} ед. Уменьшите количество или выберите другой вариант.`,
      );
    if (allocations.some((a) => a.city !== city))
      warnings.add(
        "Есть товары с других городских складов. Срок, возможность перемещения и стоимость доставки требуют согласования; дата получения не обещана.",
      );
    evaluated.set(index, {
      ...item,
      name: product.name,
      article: product.article,
      unitPrice: product.price,
      total: Math.round(product.price * item.quantity * 100) / 100,
      allocations,
      fetchedAt: product.fetchedAt,
      url: product.url,
      image: product.image,
    });
  }
  items.forEach((_, index) => lines.push(evaluated.get(index)!));
  return {
    lines,
    warnings: [...warnings],
    total:
      Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100,
  };
}
export function sameQuoteFacts(
  before: QuoteLine[],
  after: QuoteLine[],
): boolean {
  return (
    before.length === after.length &&
    before.every((line, index) => {
      const next = after[index];
      return (
        line.productId === next.productId &&
        line.quantity === next.quantity &&
        line.unitPrice === next.unitPrice &&
        JSON.stringify(line.allocations) === JSON.stringify(next.allocations)
      );
    })
  );
}

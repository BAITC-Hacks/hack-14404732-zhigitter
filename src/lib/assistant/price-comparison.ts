import type { ProductDetail } from "../catalog/types";

export function comparePrices(a: ProductDetail, b: ProductDetail) {
  const unit = (v: string | null) =>
    v?.toLowerCase().replace(/[.\s]/g, "") || null;
  const left = unit(a.unit),
    right = unit(b.unit);
  const sameUnit = left !== null && right !== null && left === right;
  const known = a.price !== null && b.price !== null;
  return {
    difference: known ? Math.abs(a.price! - b.price!) : null,
    cheaperId:
      known && a.price !== b.price ? (a.price! < b.price! ? a.id : b.id) : null,
    sameUnit,
    note: !known
      ? "Одна из цен не указана — разницу не рассчитываем."
      : !left || !right
        ? "Единицы продажи не указаны для одного или обоих товаров. Разница цен справочная; экономия на одинаковом количестве не подтверждена."
        : !sameUnit
          ? "Разные единицы продажи. Эти цены нельзя считать стоимостью одинакового количества."
          : "Разница рассчитана за одинаковую единицу продажи, без доставки. Более низкая цена не подтверждает совместимость.",
  };
}

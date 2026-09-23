import { searchProducts, normalizeSearch } from "../catalog/normalize.ts";
import type { ProductSummary } from "../catalog/types";
import type { ImportedItem } from "../assistant/types";
export function resolveImportedItems(
  rows: ImportedItem[],
  catalog: ProductSummary[],
) {
  const items: { id: number; quantity: number }[] = [],
    notices: string[] = [];
  for (const row of rows) {
    const matches = searchProducts(catalog, row.query),
      code = normalizeSearch(row.query);
    const exact = matches.find(
      (p) =>
        normalizeSearch(p.article) === code ||
        normalizeSearch(p.supplierArticle || "") === code,
    );
    const found = exact || (matches.length === 1 ? matches[0] : null);
    if (!found) {
      notices.push(
        `${row.query}: ${matches.length ? "несколько совпадений, уточните артикул" : "в выборке не найдено; другая позиция автоматически не подставлена"}.`,
      );
      continue;
    }
    const previous = items.find((item) => item.id === found.id);
    if (previous) {
      previous.quantity += row.quantity;
      notices.push(
        `${row.query}: повторяющиеся строки объединены; проверьте суммарное количество ${previous.quantity}.`,
      );
    } else items.push({ id: found.id, quantity: row.quantity });
  }
  return { items, notices };
}

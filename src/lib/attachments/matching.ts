import { normalizeSearch } from "../catalog/normalize.ts";
import type { ProductSummary } from "../catalog/types";
function supplierCode(product: ProductSummary) {
  return (
    product.supplierArticle ||
    product.name.match(/^([\d][\w./-]{2,})\s/)?.[1] ||
    ""
  );
}
export function findPhotoCodeMatches(
  catalog: ProductSummary[],
  marking: string,
) {
  const code = normalizeSearch(marking);
  const exact = code
    ? catalog.filter(
        (p) =>
          normalizeSearch(p.article) === code ||
          normalizeSearch(supplierCode(p)) === code,
      )
    : [];
  const series =
    code.length >= 3 && !code.includes(" ")
      ? catalog
          .filter((p) =>
            normalizeSearch(supplierCode(p)).startsWith(`${code} `),
          )
          .sort(
            (a, b) =>
              supplierCode(a).length - supplierCode(b).length || a.id - b.id,
          )
      : [];
  return { exact, series };
}

import "server-only";
import index from "../../../data/catalog-index.json";
import {
  normalizeSummary,
  normalizeDetail,
  searchProducts,
  asRecord,
} from "./normalize";
import type { ProductDetail, CatalogSearchResult } from "./types";

const products = index.products.map((item) =>
  normalizeSummary(item, index.syncedAt),
);

export function getCatalogIndex() {
  return products;
}
const detailCache = new Map<
  number,
  { expiresAt: number; product: ProductDetail }
>();
const inFlight = new Map<number, Promise<ProductDetail>>();

export class CatalogError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function searchCatalog(
  query: string,
  page: number,
  pageSize = 8,
): CatalogSearchResult {
  const found = searchProducts(products, query);
  return {
    products: found.slice((page - 1) * pageSize, page * pageSize),
    total: found.length,
    sampleSize: products.length,
    page,
    pageSize,
    syncedAt: index.syncedAt,
    source: index.source,
  };
}

export async function getProduct(
  id: number,
  fresh = false,
): Promise<ProductDetail> {
  const cached = detailCache.get(id);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.product;
  if (!fresh && inFlight.has(id)) return inFlight.get(id)!;
  const request = fetchProduct(id);
  if (!fresh) inFlight.set(id, request);
  try {
    const product = await request;
    if (detailCache.size >= 256)
      detailCache.delete(detailCache.keys().next().value!);
    detailCache.set(id, { product, expiresAt: Date.now() + 30000 });
    return product;
  } finally {
    if (!fresh) inFlight.delete(id);
  }
}

async function fetchProduct(id: number): Promise<ProductDetail> {
  const base = process.env.EKT_API_BASE_URL || "https://ekt.kz/api";
  const username = process.env.EKT_API_USERNAME,
    password = process.env.EKT_API_PASSWORD;
  if (!username || !password)
    throw new CatalogError(503, "Доступ к каталогу ещё не настроен.");
  if (new URL(base).origin !== "https://ekt.kz")
    throw new CatalogError(503, "Источник каталога настроен неверно.");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${base}/products/detail?id=${id}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 404)
        throw new CatalogError(404, "Товар не найден в API партнёра.");
      if (response.status >= 500 && attempt === 0) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok)
        throw new CatalogError(
          502,
          "Каталог временно недоступен. Попробуйте ещё раз.",
        );
      const data = asRecord(await response.json());
      if (Number(data.id) !== id || typeof data.name !== "string")
        throw new CatalogError(502, "Каталог вернул неполные данные товара.");
      return normalizeDetail(data, new Date().toISOString());
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      if (attempt === 0) continue;
      throw new CatalogError(
        502,
        "Не удалось обновить данные ekt.kz. Попробуйте ещё раз.",
      );
    }
  }
  throw new CatalogError(502, "Каталог временно недоступен.");
}

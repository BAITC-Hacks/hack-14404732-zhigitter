import type { ProductDetail, ProductSummary, StoreStock } from "./types";

type RecordValue = Record<string, unknown>;
export function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

export function text(value: unknown): string {
  if (typeof value === "string")
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number =
    typeof value === "number"
      ? value
      : Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function safeUrl(value: unknown, image = false): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://ekt.kz");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (
      image &&
      (url.hostname !== "ekt.kz" || !url.pathname.startsWith("/upload/"))
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /(\d)\s+(?=(?:ма|ка|кв|квт|мм|а|в|вт|м|a|v|w|ka|mm)(?![\p{L}]))/gu,
      "$1",
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeSummary(
  value: unknown,
  fallbackTime: string,
): ProductSummary {
  const raw = asRecord(value);
  const properties = asRecord(raw.properties);
  const name = text(raw.name);
  return {
    id: Number(raw.id),
    name,
    article: text(raw.article),
    supplierArticle:
      text(properties.ARTIKULPOSTAVSHCHIKA) ||
      name.match(/^(\d{5,})\b/)?.[1] ||
      null,
    price: numeric(raw.price),
    image: safeUrl(raw.image, true),
    url: safeUrl(raw.url),
    fetchedAt: text(raw.fetchedAt) || fallbackTime,
  };
}

const cityAliases: [string, RegExp][] = [
  ["Алматы", /алматы/i],
  ["Астана", /астана|нур[\s-]?султан/i],
  ["Шымкент", /шымкент/i],
  ["Караганда", /караганда/i],
  ["Атырау", /атырау/i],
  ["Актау", /актау/i],
  ["Тараз", /тараз/i],
  ["Талдыкорган", /талдыкорган/i],
  ["Усть-Каменогорск", /усть[\s-]?каменогорск/i],
];
const excludedStore = /брак|маркетинг|образц|витрин|перемещ|вос[с]?танов/i;
export function normalizeStore(value: unknown): StoreStock {
  const raw = asRecord(value);
  const name = text(raw.name);
  return {
    id: Number(raw.id),
    name,
    quantity: numeric(raw.quantity),
    city: cityAliases.find(([, pattern]) => pattern.test(name))?.[0] || null,
    excluded: excludedStore.test(name),
  };
}

export function cityStock(
  product: Pick<ProductDetail, "stores" | "stocksKnown">,
  city: string,
): number | null {
  if (!product.stocksKnown) return null;
  const stores = product.stores.filter(
    (store) => store.city === city && !store.excluded,
  );
  if (stores.some((store) => store.quantity === null)) return null;
  return stores.reduce((sum, store) => sum + (store.quantity ?? 0), 0);
}

const labels: Record<string, string> = {
  TORGOVAYA_MARKA: "Бренд",
  ARTIKULPOSTAVSHCHIKA: "Артикул производителя",
  OBYEM: "Тип товара",
  KOLICHESTVO_POLYUSOV: "Количество полюсов",
  NOMINALNYY_TOK: "Номинальный ток",
  NOMINALNOE_NAPRYAZHENIE: "Номинальное напряжение",
  NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST: "Отключающая способность",
  TIP_USTANOVKI: "Тип установки",
  STEPEN_ZASHCHITY: "Степень защиты",
  STEPEN_ZASHCHITY_IP: "Степень защиты IP",
  MOSHCHNOST: "Мощность",
  TSVETOVAYA_TEMPERATURA: "Цветовая температура",
  TSVET: "Цвет",
  MATERIAL: "Материал",
  SECHENIE: "Сечение",
  KOLICHESTVO_ZHIL: "Количество жил",
  DLINA: "Длина",
  SHIRINA: "Ширина",
  VYSOTA: "Высота",
  DIAMETR: "Диаметр",
  KRATNOST_MIN: "Кратность из каталога",
  CML2_BAR_CODE: "Штрихкод",
};

export function normalizeDetail(
  value: unknown,
  fetchedAt: string,
): ProductDetail {
  const raw = asRecord(value);
  const rawProperties = asRecord(raw.properties);
  const properties = Object.fromEntries(
    Object.entries(rawProperties).flatMap(([key, value]) => {
      const normalized = text(value);
      return normalized ? [[key, normalized]] : [];
    }),
  );
  const certificates: ProductDetail["certificates"] = [];
  // Only explicitly certificate-related fields; never invent a URL or treat an image as a certificate.
  for (const [key, value] of Object.entries({ ...rawProperties, ...raw })) {
    if (!/cert|sertif|сертифик/i.test(key)) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      const candidate =
        typeof entry === "object"
          ? (asRecord(entry).url ?? asRecord(entry).file)
          : entry;
      const url = safeUrl(candidate);
      if (
        url &&
        typeof candidate === "string" &&
        /^(https:\/\/|\/upload\/)/.test(candidate) &&
        !certificates.some((c) => c.url === url)
      )
        certificates.push({ label: "Сертификат из каталога", url });
    }
  }
  return {
    ...normalizeSummary(raw, fetchedAt),
    fetchedAt,
    description: text(raw.description),
    totalQuantity: numeric(raw.quantity),
    unit: text(raw.unit) || text(rawProperties.EDINITSA_IZMERENIYA) || null,
    stores: Array.isArray(raw.stores) ? raw.stores.map(normalizeStore) : [],
    stocksKnown: Array.isArray(raw.stores) && raw.stores.length > 0,
    attributes: Object.entries(labels).flatMap(([key, label]) =>
      properties[key] ? [{ key, label, value: properties[key] }] : [],
    ),
    certificates,
    properties,
    source: `https://ekt.kz/api/products/detail?id=${Number(raw.id)}`,
  };
}

export function searchProducts(
  products: ProductSummary[],
  query: string,
): ProductSummary[] {
  const needle = normalizeSearch(query);
  if (!needle) return products;
  const tokens = needle.split(" ");
  return products
    .map((product) => {
      const article = normalizeSearch(product.article),
        supplier = normalizeSearch(product.supplierArticle || ""),
        name = normalizeSearch(product.name);
      let score = 0;
      if (article === needle) score = 1000;
      else if (supplier === needle) score = 900;
      else if (String(product.id) === needle) score = 800;
      else if (
        tokens.every((token) =>
          `${article} ${supplier} ${name}`.includes(token),
        )
      )
        score = 100 + (name.startsWith(needle) ? 30 : 0);
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.id - b.product.id)
    .map((item) => item.product);
}

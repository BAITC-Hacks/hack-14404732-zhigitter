export type ProductSummary = {
  id: number;
  name: string;
  article: string;
  supplierArticle: string | null;
  price: number | null;
  image: string | null;
  url: string | null;
  fetchedAt: string;
};

export type StoreStock = {
  id: number;
  name: string;
  quantity: number | null;
  city: string | null;
  excluded: boolean;
};
export type ProductAttribute = { key: string; label: string; value: string };
export type ProductDetail = ProductSummary & {
  description: string;
  totalQuantity: number | null;
  unit: string | null;
  stores: StoreStock[];
  stocksKnown: boolean;
  attributes: ProductAttribute[];
  certificates: { label: string; url: string }[];
  properties: Record<string, string>;
  source: string;
};

export type CatalogSearchResult = {
  products: ProductSummary[];
  total: number;
  sampleSize: number;
  page: number;
  pageSize: number;
  syncedAt: string;
  source: string;
};

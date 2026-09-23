import type { ProductDetail } from "../catalog/types";

export type CartSelection = {
  productId: number;
  quantity: number;
  sourceCity: string | null;
  originalId: number | null;
};
export type SavedItem = CartSelection & { unitPrice: number };
export type CartState = {
  version: 1;
  revision: string;
  city: string;
  items: SavedItem[];
  lastQuoteId: string | null;
  confirmedAt: string | null;
};
export type Allocation = {
  storeId: number;
  storeName: string;
  city: string;
  quantity: number;
};
export type QuoteLine = CartSelection & {
  name: string;
  article: string;
  unitPrice: number;
  total: number;
  allocations: Allocation[];
  fetchedAt: string;
  url: string | null;
  image: string | null;
};
export type Quote = {
  id: string;
  city: string;
  lines: QuoteLine[];
  total: number;
  warnings: string[];
  expiresAt: number;
  token: string;
  operation: "append" | "replace";
};
export type QuotePayload = Omit<Quote, "token"> & {
  sessionId: string;
  baseRevision: string;
};
export type CartView = {
  state: CartState;
  total: number;
  items: {
    saved: SavedItem;
    product: ProductDetail | null;
    issue: string | null;
  }[];
  href: string;
};
export type SupplyOption = {
  id: string;
  label: string;
  detail: string;
  lines: CartSelection[];
  covered: number;
  total: number;
  warnings: string[];
};

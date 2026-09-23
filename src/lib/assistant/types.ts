import type { ProductDetail } from "../catalog/types";

export const cities = [
  "Алматы",
  "Астана",
  "Шымкент",
  "Караганда",
  "Атырау",
  "Актау",
  "Тараз",
  "Талдыкорган",
  "Усть-Каменогорск",
] as const;
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ImportedItem = { query: string; quantity: number };
export type SalesHelp = {
  kind: "budget" | "urgent" | "approval" | "compatibility";
  productId: number;
  quantity: number | null;
};
export type ChatRequest = {
  salesHelp?: SalesHelp;
  messages: ChatMessage[];
  city: string;
  expectedItems?: number;
  importItems?: ImportedItem[];
};
export type Conflict = {
  field: string;
  nameValue: string;
  propertyValue: string;
};
export type Comparison = {
  originalId: number;
  originalName: string;
  matches: string[];
  differences: string[];
  unknowns: string[];
  blocked: boolean;
};
export type AssistantCard = {
  product: ProductDetail;
  localStock: number | null;
  requestedQuantity: number | null;
  conflicts: Conflict[];
  comparison: Comparison | null;
};
export type Terms = {
  title: string;
  text: string;
  url: string;
  checkedAt: string;
};
export type AssistantReply = {
  priceComparison?: boolean;
  salesHelp?: {
    kind: SalesHelp["kind"];
    title: string;
    summary: string;
    draft?: string;
  };
  clarification?: boolean;
  requestedLineCount?: number;
  id: string;
  text: string;
  language: "ru" | "kk";
  city: string;
  cards: AssistantCard[];
  terms: Terms[];
  notices: string[];
  suggestions: string[];
  cartChanged: false;
  elapsedMs: number;
};
export type Selection = {
  intent: "product" | "alternative" | "terms" | "clarify" | "cart";
  language: "ru" | "kk";
  city: string | null;
  items: { id: number; quantity: number | null }[];
  alternativeIds: number[];
  question: string;
  topics: ("payment" | "delivery" | "minimum")[];
};

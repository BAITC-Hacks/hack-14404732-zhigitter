import type { ChatRequest, Selection } from "./types";

export function validateRequest(
  input: unknown,
  allowedCities: readonly string[],
): ChatRequest | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  if (
    typeof data.city !== "string" ||
    !allowedCities.includes(data.city) ||
    !Array.isArray(data.messages) ||
    data.messages.length < 1 ||
    data.messages.length > 12
  )
    return null;
  let total = 0;
  for (const message of data.messages) {
    if (
      !message ||
      typeof message !== "object" ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > 6000
    )
      return null;
    total += message.content.length;
  }
  if (total > 22000 || data.messages.at(-1).role !== "user") return null;
  return {
    city: data.city,
    messages: data.messages.map((m) => ({
      role: m.role,
      content: m.content.trim(),
    })),
  };
}

export function validateSelection(
  input: unknown,
  ids: Set<number>,
  allowedCities: readonly string[],
): Selection {
  if (!input || typeof input !== "object") throw new Error("Invalid selection");
  const data = input as Selection;
  if (
    !["product", "alternative", "terms", "clarify", "cart"].includes(
      data.intent,
    ) ||
    !["ru", "kk"].includes(data.language) ||
    !Array.isArray(data.items) ||
    !Array.isArray(data.alternativeIds) ||
    !Array.isArray(data.topics) ||
    typeof data.question !== "string" ||
    !(data.city === null || allowedCities.includes(data.city))
  )
    throw new Error("Invalid selection");
  const used = new Set<number>();
  const items = data.items
    .slice(0, 4)
    .filter((item) => {
      if (
        !item ||
        !Number.isSafeInteger(item.id) ||
        !ids.has(item.id) ||
        used.has(item.id)
      )
        return false;
      used.add(item.id);
      return true;
    })
    .map((item) => ({
      id: item.id,
      quantity:
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 100000
          ? item.quantity
          : null,
    }));
  return {
    intent: data.intent,
    language: data.language,
    city: data.city,
    items,
    alternativeIds: [...new Set(data.alternativeIds)]
      .filter((id) => Number.isSafeInteger(id) && ids.has(id) && !used.has(id))
      .slice(0, 3),
    topics: data.topics.filter((topic) =>
      ["payment", "delivery", "minimum"].includes(topic),
    ),
    question: data.question.slice(0, 400),
  };
}

export const selectionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "language",
    "city",
    "items",
    "alternativeIds",
    "question",
    "topics",
  ],
  properties: {
    intent: {
      type: "string",
      enum: ["product", "alternative", "terms", "clarify", "cart"],
    },
    language: { type: "string", enum: ["ru", "kk"] },
    city: { type: ["string", "null"] },
    items: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "quantity"],
        properties: {
          id: { type: "integer" },
          quantity: { type: ["number", "null"] },
        },
      },
    },
    alternativeIds: { type: "array", maxItems: 3, items: { type: "integer" } },
    question: { type: "string" },
    topics: {
      type: "array",
      items: { type: "string", enum: ["payment", "delivery", "minimum"] },
    },
  },
};

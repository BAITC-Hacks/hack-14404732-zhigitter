import type { Extraction, ExtractedItem } from "./types";
export const MAX_UPLOAD = 3 * 1024 * 1024;
export function fileKind(
  bytes: Uint8Array,
  name: string,
): "image" | "pdf" | "text" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image";
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image";
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (/\.(txt|csv)$/i.test(name) && !bytes.includes(0)) return "text";
  return null;
}
export function validateExtraction(value: unknown, photo: boolean): Extraction {
  if (!value || typeof value !== "object")
    throw new Error("Invalid extraction");
  const data = value as Record<string, unknown>;
  if (
    !Array.isArray(data.items) ||
    typeof data.warning !== "string" ||
    typeof data.ignoredInstructions !== "boolean" ||
    typeof data.truncated !== "boolean"
  )
    throw new Error("Invalid extraction");
  const items: ExtractedItem[] = data.items
    .slice(0, 4)
    .map((item) => {
      if (
        !item ||
        typeof item.description !== "string" ||
        typeof item.marking !== "string" ||
        typeof item.evidence !== "string" ||
        typeof item.uncertain !== "boolean"
      )
        throw new Error("Invalid extraction item");
      const clean = (s: string, max: number) =>
        s
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, max);
      return {
        description: clean(item.description, 200),
        marking: clean(item.marking, 100),
        evidence: clean(item.evidence, 250),
        uncertain: item.uncertain,
        quantity:
          !photo &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 100000
            ? item.quantity
            : null,
      };
    })
    .filter((item) => item.description || item.marking);
  return {
    items,
    warning: data.warning.slice(0, 500),
    ignoredInstructions: data.ignoredInstructions,
    truncated: data.truncated || data.items.length > 4,
  };
}
export const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "warning", "ignoredInstructions", "truncated"],
  properties: {
    items: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "description",
          "marking",
          "quantity",
          "evidence",
          "uncertain",
        ],
        properties: {
          description: { type: "string" },
          marking: { type: "string" },
          quantity: { type: ["integer", "null"] },
          evidence: { type: "string" },
          uncertain: { type: "boolean" },
        },
      },
    },
    warning: { type: "string" },
    ignoredInstructions: { type: "boolean" },
    truncated: { type: "boolean" },
  },
};

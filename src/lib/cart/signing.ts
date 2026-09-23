import { createHmac, timingSafeEqual } from "node:crypto";

function signature(body: string, key: string, purpose: string) {
  return createHmac("sha256", key)
    .update(`${purpose}:${body}`)
    .digest("base64url");
}
export function signValue(
  value: unknown,
  key: string,
  purpose: string,
): string {
  if (key.length < 32) throw new Error("Signing key unavailable");
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${signature(body, key, purpose)}`;
}
export function readSigned<T>(
  token: string,
  key: string,
  purpose: string,
  maxLength = 50000,
): T | null {
  if (!token || token.length > maxLength || key.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0], key, purpose));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

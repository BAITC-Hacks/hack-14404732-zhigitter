import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cities } from "../assistant/types";
import { getCatalogIndex, getProduct } from "../catalog/server";
import {
  CartError,
  evaluateSelections,
  mergeSelections,
  sameQuoteFacts,
  validSelections,
} from "./core";
import { readSigned, signValue } from "./signing";
import type {
  CartSelection,
  CartState,
  CartView,
  Quote,
  QuotePayload,
} from "./types";

const CART = "komplekt_cart",
  SESSION = "komplekt_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};
function secret() {
  const key = process.env.CART_SIGNING_SECRET;
  if (!key || key.length < 32)
    throw new CartError(503, "Корзина ещё не настроена.");
  return key;
}
async function context() {
  const jar = await cookies(),
    key = secret();
  let session = readSigned<{ id: string }>(
    jar.get(SESSION)?.value || "",
    key,
    "session",
  );
  if (!session?.id) {
    session = { id: randomUUID() };
    jar.set(SESSION, signValue(session, key, "session"), cookieOptions);
  }
  const encoded = jar.get(CART)?.value;
  const state = encoded
    ? readSigned<CartState>(encoded, key, "cart", 4000)
    : {
        version: 1 as const,
        revision: "empty",
        city: "Алматы",
        items: [],
        lastQuoteId: null,
        confirmedAt: null,
      };
  if (!state || state.version !== 1 || !Array.isArray(state.items))
    throw new CartError(
      400,
      "Не удалось проверить сохранённую корзину. Очистите cookies этого сайта и повторите.",
    );
  return { jar, key, session, state };
}
async function productsFor(items: CartSelection[], fresh: boolean) {
  const ids = [
    ...new Set(
      items.flatMap((item) => [
        item.productId,
        ...(item.originalId ? [item.originalId] : []),
      ]),
    ),
  ];
  const allowed = new Set(getCatalogIndex().map((p) => p.id));
  if (ids.some((id) => !allowed.has(id)))
    throw new CartError(
      400,
      "Товар отсутствует в доступном каталоге прототипа.",
    );
  const products = await Promise.all(
    ids.map(async (id) => [id, await getProduct(id, fresh)] as const),
  );
  return new Map(products);
}
export async function viewCart(): Promise<CartView> {
  const { state } = await context();
  const items = await Promise.all(
    state.items.map(async (saved) => {
      try {
        const product = await getProduct(saved.productId);
        let issue: string | null = null;
        try {
          evaluateSelections(
            state.items.filter(
              (i) => i.productId === saved.productId && !i.originalId,
            ),
            state.city,
            new Map([[product.id, product]]),
          );
        } catch (error) {
          issue =
            error instanceof CartError
              ? error.message
              : "Наличие требует проверки.";
        }
        if (product.price !== saved.unitPrice)
          issue = "Цена изменилась после подтверждения. Перепроверьте корзину.";
        return { saved, product, issue };
      } catch {
        return {
          saved,
          product: null,
          issue: "API недоступен. Сохранённый состав не потерян.",
        };
      }
    }),
  );
  return {
    state,
    items,
    total:
      Math.round(
        state.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ) * 100,
      ) / 100,
    href: "/cart",
  };
}
export async function makeQuote(input: unknown): Promise<Quote> {
  if (!input || typeof input !== "object")
    throw new CartError(400, "Некорректный запрос.");
  const body = input as Record<string, unknown>;
  if (
    !cities.includes(body.city as (typeof cities)[number]) ||
    !(body.operation === "append" || body.operation === "replace")
  )
    throw new CartError(400, "Проверьте город и действие.");
  const { state, session, key } = await context(),
    city = body.city as string;
  const selected = validSelections(body.items, cities);
  if (body.operation === "append" && !selected.length)
    throw new CartError(400, "Сначала выберите товары.");
  if (body.operation === "append" && state.items.length && state.city !== city)
    throw new CartError(
      409,
      `В корзине выбран город ${state.city}. Завершите подбор в этом городе или очистите корзину.`,
    );
  const items = mergeSelections(
    body.operation === "append" ? [...state.items, ...selected] : selected,
  );
  const facts = evaluateSelections(items, city, await productsFor(items, true));
  const payload: QuotePayload = {
    ...facts,
    id: randomUUID(),
    city,
    operation: body.operation,
    expiresAt: Date.now() + 5 * 60 * 1000,
    sessionId: session.id,
    baseRevision: state.revision,
  };
  return { ...payload, token: signValue(payload, key, "quote") };
}
export async function confirmQuote(
  input: unknown,
): Promise<{ href: string; count: number; unchanged: boolean }> {
  const body = input as Record<string, unknown> | null;
  if (!body || body.confirmed !== true || typeof body.token !== "string")
    throw new CartError(400, "Нужно явное подтверждение состава корзины.");
  const { state, session, key, jar } = await context();
  const quote = readSigned<QuotePayload>(body.token, key, "quote");
  if (!quote || quote.sessionId !== session.id)
    throw new CartError(
      403,
      "Предложение не прошло проверку. Сформируйте его заново.",
    );
  if (quote.id === state.lastQuoteId)
    return { href: "/cart", count: state.items.length, unchanged: true };
  if (quote.expiresAt < Date.now())
    throw new CartError(409, "Предложение устарело. Обновите цены и остатки.");
  if (quote.baseRevision !== state.revision)
    throw new CartError(
      409,
      "Корзина уже изменилась. Сформируйте предложение заново.",
    );
  if (quote.warnings.length && body.acknowledgeWarnings !== true)
    throw new CartError(
      400,
      "Подтвердите, что ознакомились с условиями замены и доставки.",
    );
  const selections = validSelections(quote.lines, cities),
    facts = evaluateSelections(
      selections,
      quote.city,
      await productsFor(selections, true),
    );
  if (
    !sameQuoteFacts(quote.lines, facts.lines) ||
    JSON.stringify(quote.warnings) !== JSON.stringify(facts.warnings)
  )
    throw new CartError(
      409,
      "Цена, наличие или условия изменились. Корзина не изменена — обновите предложение.",
    );
  const updated: CartState = {
    version: 1,
    revision: randomUUID(),
    city: quote.city,
    items: facts.lines.map(
      ({ productId, quantity, sourceCity, originalId, unitPrice }) => ({
        productId,
        quantity,
        sourceCity,
        originalId,
        unitPrice,
      }),
    ),
    lastQuoteId: quote.id,
    confirmedAt: new Date().toISOString(),
  };
  const encoded = signValue(updated, key, "cart");
  if (encoded.length > 3800)
    throw new CartError(
      400,
      "Корзина слишком большая для прототипа. Уменьшите число строк.",
    );
  jar.set(CART, encoded, cookieOptions);
  return { href: "/cart", count: updated.items.length, unchanged: false };
}
export async function cartAction(
  request: Request,
  action: (body: unknown) => Promise<unknown>,
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const origin = request.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !==
        (request.headers.get("host") || new URL(request.url).host)
    )
      throw new CartError(403, "Запрос с другого сайта не разрешён.");
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new CartError(403, "Запрос с другого сайта не разрешён.");
    const raw = await request.text();
    if (raw.length > 60000) throw new CartError(413, "Запрос слишком большой.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new CartError(400, "Некорректный формат запроса.");
    }
    return Response.json(await action(body), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CartError
            ? error.message
            : "Не удалось проверить корзину через API. Повторите попытку.",
      },
      { status: error instanceof CartError ? error.status : 502, headers },
    );
  }
}

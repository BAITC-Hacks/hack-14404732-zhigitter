import { cartAction, makeQuote } from "@/lib/cart/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return cartAction(request, makeQuote);
}

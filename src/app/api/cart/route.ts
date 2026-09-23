import { viewCart } from "@/lib/cart/server";
import { CartError } from "@/lib/cart/core";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    return Response.json(await viewCart(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CartError
            ? error.message
            : "Корзина временно недоступна.",
      },
      {
        status: error instanceof CartError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

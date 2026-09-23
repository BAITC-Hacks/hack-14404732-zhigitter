import { viewCart } from "@/lib/cart/server";
import { specificationCsv } from "@/lib/cart/export";
import { CartError } from "@/lib/cart/core";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    return new Response(specificationCsv(await viewCart()), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=komplekt-specification.csv",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CartError
            ? error.message
            : "Не удалось подготовить спецификацию.",
      },
      {
        status: error instanceof CartError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

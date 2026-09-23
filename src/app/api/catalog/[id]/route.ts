import { getProduct, CatalogError } from "@/lib/catalog/server";

export const maxDuration = 30;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  if (!/^[1-9]\d{0,8}$/.test(rawId))
    return Response.json(
      { error: "Некорректный идентификатор товара." },
      { status: 400 },
    );
  try {
    const product = await getProduct(
      Number(rawId),
      new URL(request.url).searchParams.get("refresh") === "1",
    );
    return Response.json(product, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CatalogError
            ? error.message
            : "Не удалось получить товар.",
      },
      {
        status: error instanceof CatalogError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

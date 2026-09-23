import { searchCatalog } from "@/lib/catalog/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const page = Number(url.searchParams.get("page") || 1);
  if (
    query.length > 160 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 25
  )
    return Response.json(
      { error: "Проверьте поисковый запрос и номер страницы." },
      { status: 400 },
    );
  return Response.json(searchCatalog(query, page), {
    headers: { "Cache-Control": "no-store" },
  });
}

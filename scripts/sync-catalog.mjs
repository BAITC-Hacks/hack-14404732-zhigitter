import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.EKT_API_BASE_URL || "https://ekt.kz/api";
if (new URL(base).origin !== "https://ekt.kz")
  throw new Error("Only the ekt.kz API is supported.");
if (!process.env.EKT_API_USERNAME || !process.env.EKT_API_PASSWORD)
  throw new Error("EKT credentials are missing in .env.local");
const authorization = `Basic ${Buffer.from(`${process.env.EKT_API_USERNAME}:${process.env.EKT_API_PASSWORD}`).toString("base64")}`;
const pages = [];
const startedAt = new Date().toISOString();
// Bound traffic to the partner API: three requests in flight at most.
for (let start = 1; start <= 10; start += 3) {
  const batch = Array.from(
    { length: Math.min(3, 11 - start) },
    (_, i) => start + i,
  );
  pages.push(
    ...(await Promise.all(
      batch.map(async (page) => {
        const response = await fetch(`${base}/products?page=${page}`, {
          headers: { Authorization: authorization },
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok)
          throw new Error(`Catalog page ${page}: HTTP ${response.status}`);
        const body = await response.json();
        if (!Array.isArray(body.items))
          throw new Error(`Catalog page ${page}: invalid response`);
        console.log(`Page ${page}: ${body.items.length} products`);
        return { page, fetchedAt: new Date().toISOString(), items: body.items };
      }),
    )),
  );
}
const products = [
  ...new Map(
    pages
      .sort((a, b) => a.page - b.page)
      .flatMap((page) =>
        page.items.map((item) => [
          item.id,
          {
            id: item.id,
            name: item.name,
            article: item.article,
            price: item.price,
            image: item.image,
            url: item.url,
            fetchedAt: page.fetchedAt,
          },
        ]),
      )
      .filter(
        ([id, item]) =>
          Number.isSafeInteger(id) && typeof item.name === "string",
      ),
  ).values(),
].slice(0, 200);
if (!products.length)
  throw new Error("Empty catalog; previous index was not replaced");
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/catalog-index.json", import.meta.url),
  JSON.stringify(
    {
      source: "https://ekt.kz/api/products",
      startedAt,
      syncedAt: new Date().toISOString(),
      limit: 200,
      products,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${products.length} real catalog entries. Stock will be fetched from detail endpoints.`,
);

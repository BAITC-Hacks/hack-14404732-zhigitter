import { analyzeAttachment } from "@/lib/attachments/server";
import { AssistantError } from "@/lib/assistant/openai";
import { cities } from "@/lib/assistant/types";
import { MAX_UPLOAD } from "@/lib/attachments/validation";
export const runtime = "nodejs";
export const maxDuration = 60;
const buckets = new Map<string, { count: number; expires: number }>();
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const origin = request.headers.get("origin");
    if (
      (origin &&
        new URL(origin).host !==
          (request.headers.get("host") || new URL(request.url).host)) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new AssistantError(403, "Запрос с другого сайта не разрешён.");
    const key =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "local",
      now = Date.now(),
      old = buckets.get(key);
    if (old && old.expires > now && old.count >= 8)
      throw new AssistantError(
        429,
        "До 8 распознаваний в минуту. Подождите немного.",
      );
    if (buckets.size > 1000) {
      for (const [id, bucket] of buckets)
        if (bucket.expires <= now) buckets.delete(id);
      if (buckets.size > 1000) buckets.delete(buckets.keys().next().value!);
    }
    buckets.set(key, {
      count: old && old.expires > now ? old.count + 1 : 1,
      expires: old && old.expires > now ? old.expires : now + 60000,
    });
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD + 20000)
      throw new AssistantError(
        413,
        "Файл слишком большой. Максимум 3 МБ после подготовки.",
      );
    // Bound the streamed body too; do not rely on a client-supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new AssistantError(400, "Файл не выбран.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_UPLOAD + 20000) {
        await reader.cancel();
        throw new AssistantError(413, "Файл слишком большой.");
      }
      chunks.push(value);
    }
    const data = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = data.get("file"),
      mode = data.get("mode"),
      city = data.get("city");
    if (
      !(file instanceof File) ||
      !(mode === "photo" || mode === "list") ||
      typeof city !== "string" ||
      !cities.includes(city as (typeof cities)[number])
    )
      throw new AssistantError(400, "Выберите файл, режим и город.");
    return Response.json(
      await analyzeAttachment(file, mode, city, request.signal),
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AssistantError
            ? error.message
            : "Не удалось прочитать вложение. Проверьте формат файла.",
      },
      { status: error instanceof AssistantError ? error.status : 400, headers },
    );
  }
}

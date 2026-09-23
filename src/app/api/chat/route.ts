import { answerRequest } from "@/lib/assistant/server";
import { AssistantError } from "@/lib/assistant/openai";
import { validateRequest } from "@/lib/assistant/validation";
import { cities } from "@/lib/assistant/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const requests = new Map<string, { count: number; expires: number }>();

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  // Same-origin browser requests only; no CORS permission for third-party pages.
  const origin = request.headers.get("origin");
  let sameOrigin = true;
  try {
    sameOrigin =
      !origin ||
      new URL(origin).host ===
        (request.headers.get("host") || new URL(request.url).host);
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin)
    return Response.json(
      { error: "Запрос с другого сайта не разрешён." },
      { status: 403, headers },
    );
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now(),
    bucket = requests.get(address);
  if (bucket && bucket.expires > now && bucket.count >= 20)
    return Response.json(
      { error: "Слишком много запросов. Подождите минуту." },
      { status: 429, headers },
    );
  if (requests.size > 1000) {
    for (const [key, value] of requests)
      if (value.expires <= now) requests.delete(key);
    if (requests.size > 1000) requests.delete(requests.keys().next().value!);
  }
  requests.set(address, {
    count: bucket && bucket.expires > now ? bucket.count + 1 : 1,
    expires: bucket && bucket.expires > now ? bucket.expires : now + 60000,
  });
  try {
    const raw = await request.text();
    if (raw.length > 30000)
      return Response.json(
        { error: "Запрос слишком большой. Сократите список." },
        { status: 413, headers },
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "Некорректный формат запроса." },
        { status: 400, headers },
      );
    }
    const input = validateRequest(parsed, cities);
    if (!input)
      return Response.json(
        {
          error:
            "Проверьте текст запроса и город. За один запрос — до четырёх позиций.",
        },
        { status: 400, headers },
      );
    return Response.json(await answerRequest(input, request.signal), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AssistantError
            ? error.message
            : "Не удалось получить ответ. Попробуйте ещё раз.",
      },
      { status: error instanceof AssistantError ? error.status : 500, headers },
    );
  }
}

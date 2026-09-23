type JsonRecord = Record<string, unknown>;
const record = (v: unknown): JsonRecord =>
  v && typeof v === "object" ? (v as JsonRecord) : {};
export class ResponseFailure extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
// Retry only recoverable failures. Never consume an incomplete/refused JSON response.
export async function structuredResponse<T>(options: {
  key: string;
  body: JsonRecord;
  validate: (value: unknown) => T;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<T> {
  const fetcher = options.fetcher || fetch;
  for (let attempt = 0; attempt < 2; attempt++) {
    options.signal?.throwIfAborted();
    let requestId: string | null = null;
    let reason = "network_or_invalid_json";
    try {
      const response = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.key}`,
        },
        signal: AbortSignal.any([
          ...(options.signal ? [options.signal] : []),
          AbortSignal.timeout(options.timeoutMs || 13000),
        ]),
        body: JSON.stringify({
          ...options.body,
          store: false,
          max_output_tokens: attempt ? 3200 : 2200,
        }),
      });
      requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429)
          throw new ResponseFailure(
            429,
            "Лимит AI временно исчерпан. Поиск по артикулу и каталог доступны.",
          );
        if ([401, 403].includes(response.status))
          throw new ResponseFailure(
            503,
            "Нужно проверить доступ к AI. Поиск по артикулу и каталог доступны.",
          );
        if (response.status < 500 && response.status !== 408)
          throw new ResponseFailure(
            502,
            "AI не принял запрос. Уточните артикул или откройте каталог.",
          );
        reason = `upstream_${response.status}`;
        throw new Error(reason);
      }
      const body = record(await response.json());
      const parts = (Array.isArray(body.output) ? body.output : []).flatMap(
        (v) => {
          const content = record(v).content;
          return Array.isArray(content) ? content.map(record) : [];
        },
      );
      if (
        parts.some((p) => p.type === "refusal") ||
        record(body.incomplete_details).reason === "content_filter"
      )
        throw new ResponseFailure(
          422,
          "Не удалось обработать этот запрос. Опишите электротовар или укажите артикул.",
        );
      if (body.status !== "completed") {
        reason = String(
          record(body.incomplete_details).reason ||
            body.status ||
            "missing_status",
        ).slice(0, 80);
        throw new Error("Incomplete response");
      }
      const output = parts
        .filter((p) => p.type === "output_text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      return options.validate(JSON.parse(output));
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof ResponseFailure) throw error;
      // No prompts, output, uploaded files, credentials or customer data in logs.
      console.warn("assistant_response_retry", {
        attempt: attempt + 1,
        reason,
        requestId,
      });
      if (attempt === 1)
        throw new ResponseFailure(
          502,
          "AI временно не отвечает после повторной попытки. Введите точный артикул или воспользуйтесь каталогом.",
        );
    }
  }
  throw new ResponseFailure(502, "AI временно недоступен.");
}

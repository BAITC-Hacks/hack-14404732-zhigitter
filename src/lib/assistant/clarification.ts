import type { ProductSummary } from "../catalog/types";
import type { ChatRequest } from "./types";

function deviceFamily(text: string) {
  if (/диф|авдт/i.test(text)) return "rcbo";
  if (/узо/i.test(text)) return "rcd";
  if (/автомат|(?:^|\s)ав(?:\s|$)/i.test(text)) return "breaker";
  if (/клемм|терминал/i.test(text)) return "terminal";
  return null;
}
function awaitingDetails(content: string) {
  try {
    return JSON.parse(content).clarification === true;
  } catch {
    return /Чтобы подобрать товар|Тауарды таңдау үшін/.test(content);
  }
}
export function getClarification(
  request: ChatRequest,
  catalog: ProductSummary[],
) {
  if (request.importItems) return null;
  const latest = request.messages.at(-1)!.content;
  const kk =
    !/на русском|по-русски/i.test(latest) &&
    /[әғқңөұүһі]|керек|қазақ/i.test(latest);
  // Exact identifiers bypass guided selection, even when the name contains a device family.
  const tokens: string[] =
    latest.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
  if (
    catalog.some((p) =>
      [
        p.article,
        p.supplierArticle,
        p.name.match(/^\s*([\d][\d-]{3,})/)?.[1],
      ].some((code) => code && tokens.includes(code.toLowerCase())),
    )
  )
    return null;
  if (
    /достав|оплат|платеж|корзин|жеткіз|төле|себет/i.test(latest) &&
    !deviceFamily(latest)
  )
    return null;
  let context = latest;
  const previous = request.messages.at(-2);
  const pending =
    previous?.role === "assistant" && awaitingDetails(previous.content);
  if (pending && !/теперь|другой|вместо/i.test(latest)) {
    const users = request.messages
      .slice(0, -1)
      .filter((m) => m.role === "user");
    const start = users.findLastIndex((m) => deviceFamily(m.content));
    if (
      start >= 0 &&
      (!deviceFamily(latest) ||
        deviceFamily(latest) === deviceFamily(users[start].content))
    )
      context = [...users.slice(start).map((m) => m.content), latest].join(
        "\n",
      );
  }
  const family = deviceFamily(context);
  if (!family) return null;
  const questions: string[] = [],
    suggestions: string[] = [];
  if (family === "terminal") {
    if (
      !/\d+\s*[- ]?\s*(?:пров|сым)|(?:пров|сым)[^\d\n]{0,12}\d+/i.test(context)
    ) {
      questions.push(
        kk
          ? "Қанша сымға арналған клемма керек?"
          : "На сколько проводников нужна клемма?",
      );
      suggestions.push(
        "На 2 проводника",
        "На 3 проводника",
        "На 5 проводников",
      );
    }
  } else {
    if (!/\d+(?:[.,]\d+)?\s*[аa](?![\p{L}])|\d+\s*ампер/iu.test(context)) {
      questions.push(
        kk
          ? "Номиналды ток қандай (А)?"
          : "Какой номинальный ток нужен (в амперах)?",
      );
      suggestions.push("Номинал 16 А", "Номинал 25 А", "Номинал 40 А");
    }
    if (
      !/\d\s*(?:[pрф](?![\p{L}])|полюс)|(?:одно|двух|тр[её]х|четыр[её]х)полюс/iu.test(
        context,
      )
    ) {
      questions.push(
        kk
          ? "Неше полюс қажет (мысалы, 1P, 1P+N немесе 3P)?"
          : "Сколько полюсов: например, 1P, 1P+N или 3P?",
      );
      if (!suggestions.length) suggestions.push("1P", "1P+N", "3P");
    }
    if (family !== "breaker" && !/\d+\s*[мm][аa]/i.test(context)) {
      questions.push(
        kk ? "Ағып кету тогы қандай (мА)?" : "Какой ток утечки нужен (в мА)?",
      );
      if (!suggestions.length) suggestions.push("30 мА", "100 мА", "300 мА");
    }
  }
  if (!questions.length) return null;
  const unknown = /не знаю|неизвест|білмеймін/i.test(latest);
  return {
    language: kk ? ("kk" as const) : ("ru" as const),
    text: unknown
      ? kk
        ? "Тауарды таңдау үшін құрылғының таңбалауын білу керек. «По фото» арқылы таңбалауы анық көрінетін суретті жіберіңіз немесе жобадағы параметрлерді жазыңыз."
        : "Чтобы подобрать товар, нужна маркировка или параметры из проекта. Нажмите «По фото» и загрузите чёткий снимок надписей на устройстве. По назначению комнаты номинал не угадываю."
      : (kk
          ? "Тауарды таңдау үшін параметрлерді нақтылайық:\n\n"
          : "Чтобы подобрать товар, уточним параметры:\n\n") +
        questions.slice(0, 2).join("\n") +
        (kk
          ? "\n\nЖобадағы немесе ескі құрылғыдағы мәндерді көрсетіңіз."
          : "\n\nУкажите значения из проекта или с маркировки устройства. Кнопки ниже — варианты ответа, не рекомендация номинала."),
    suggestions: unknown ? [] : suggestions,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AssistantCard,
  AssistantReply,
  ChatMessage,
} from "@/lib/assistant/types";

type Entry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: AssistantReply };
const examples = [
  {
    label: "Проверить наличие",
    text: "Нужны 10 штук 027228 в Алматы. Какие характеристики и остатки?",
  },
  {
    label: "Найти замену",
    text: "Нужен 007886 Legrand. Если его нет, найди аналог и объясни различия.",
  },
  {
    label: "Доставка и оплата",
    text: "Как оплатить заказ юрлицу и получить доставку в Алматы?",
  },
];
function formatMoney(value: number | null) {
  return value === null
    ? "Цена не указана"
    : `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}
function sourceTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
}

function ResultCard({ card, city }: { card: AssistantCard; city: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const p = card.product;
  const shortfall =
    card.requestedQuantity !== null && card.localStock !== null
      ? Math.max(0, card.requestedQuantity - card.localStock)
      : null;
  return (
    <article
      className={`answer-product ${card.conflicts.length ? "has-conflict" : ""}`}
    >
      {card.comparison && (
        <div className="candidate-label">
          {card.comparison.blocked
            ? "Совместимость не подтверждена"
            : "Кандидат на замену — требует проверки"}
        </div>
      )}
      <div className="answer-product-head">
        <div className="answer-photo">
          {p.image && !imageFailed ? (
            <Image
              src={p.image}
              alt={p.name}
              fill
              sizes="64px"
              unoptimized
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Package size={25} />
          )}
        </div>
        <div>
          <p className="product-article">
            Артикул {p.article} · ID {p.id}
          </p>
          <h3>{p.name}</h3>
        </div>
      </div>
      <div className="answer-numbers">
        <div>
          <span>Цена из API</span>
          <strong>{formatMoney(p.price)}</strong>
        </div>
        <div>
          <span>{city}</span>
          <strong>
            {card.localStock === null
              ? "Нет данных"
              : `${card.localStock} ${p.unit || "ед."}`}
          </strong>
        </div>
        <div>
          <span>Общий остаток API</span>
          <strong>
            {p.totalQuantity === null
              ? "Нет данных"
              : `${p.totalQuantity} ${p.unit || "ед."}`}
          </strong>
        </div>
      </div>
      {card.requestedQuantity !== null && (
        <p className={`quantity-note ${shortfall ? "quantity-short" : ""}`}>
          Запрошено: {card.requestedQuantity}.{" "}
          {shortfall === null
            ? "Наличие нужного количества в городе пока не подтверждено."
            : shortfall > 0
              ? `В городе не хватает ${shortfall}. Остатки других складов — ниже; срок перемещения нужно подтвердить.`
              : "Указанного городского остатка достаточно. Резерв ещё не создан."}
        </p>
      )}
      {card.conflicts.map((conflict) => (
        <div className="conflict-note" key={conflict.field}>
          <AlertTriangle size={17} />
          <div>
            <strong>Расхождение: {conflict.field.toLowerCase()}</strong>
            <p>
              {conflict.nameValue} · {conflict.propertyValue}.
            </p>
            <p>
              Номинал требует проверки у поставщика. Не считаем этот товар
              подтверждённой заменой.
            </p>
          </div>
        </div>
      ))}
      {card.comparison && (
        <div className="comparison">
          <p>
            Сравнение с: <strong>{card.comparison.originalName}</strong>
          </p>
          {card.comparison.matches.length > 0 && (
            <div>
              <h4>Совпадает по каталогу</h4>
              <ul>
                {card.comparison.matches.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {card.comparison.differences.length > 0 && (
            <div>
              <h4>Различается</h4>
              <ul>
                {card.comparison.differences.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4>Нужно подтвердить</h4>
            <ul>
              {card.comparison.unknowns.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <details className="answer-details">
        <summary>Характеристики, склады и документы</summary>
        <dl className="attribute-list">
          {p.attributes.map((a) => (
            <div key={a.key}>
              <dt>{a.label}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>
        {!p.attributes.length && <p>Характеристики не предоставлены.</p>}
        <h4>Остатки по обычным складам</h4>
        <ul className="store-list">
          {p.stores
            .filter(
              (s) => !s.excluded && (s.quantity === null || s.quantity > 0),
            )
            .map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <strong>{s.quantity ?? "Нет данных"}</strong>
              </li>
            ))}
        </ul>
        {!p.stocksKnown && <p>Разбивка по складам не предоставлена.</p>}
        <p className="source-note">
          Технические склады исключены из городского остатка. Общий остаток API
          может включать их.
        </p>
        <h4>Сертификаты</h4>
        {p.certificates.length ? (
          p.certificates.map((c) => (
            <a
              className="source-link"
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noreferrer"
            >
              {c.label} <ExternalLink size={12} />
            </a>
          ))
        ) : (
          <p>Ссылка на сертификат в API не найдена.</p>
        )}
        {p.description && (
          <>
            <h4>Описание поставщика</h4>
            <p className="product-description">{p.description}</p>
          </>
        )}
      </details>
      <div className="answer-source">
        <span>API ekt.kz · {sourceTime(p.fetchedAt)} (UTC+5)</span>
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer">
            Источник <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

function history(entries: Entry[]): ChatMessage[] {
  const messages: ChatMessage[] = entries.slice(-10).map((entry) =>
    entry.role === "user"
      ? { role: "user", content: entry.text }
      : {
          role: "assistant",
          content: JSON.stringify({
            text: entry.reply.text,
            city: entry.reply.city,
            items: entry.reply.cards.map((c) => ({
              id: c.product.id,
              article: c.product.article,
              name: c.product.name,
              quantity: c.requestedQuantity,
              alternativeFor: c.comparison?.originalId || null,
            })),
          }).slice(0, 5000),
        },
  );
  while (
    messages.reduce((sum, message) => sum + message.content.length, 0) > 16000
  )
    messages.splice(0, 2);
  return messages;
}

export function AssistantChat({
  city,
  onCityChange,
}: {
  city: string;
  onCityChange: (city: string) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null),
    log = useRef<HTMLDivElement>(null),
    active = useRef<AbortController | null>(null);
  useEffect(() => {
    const container = log.current;
    if (!container) return;
    const latest = container.querySelector(".assistant-message:last-child");
    const top =
      !pending && latest
        ? latest.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop -
          18
        : container.scrollHeight;
    container.scrollTo({ top, behavior: "smooth" });
    if (!pending && entries.length)
      textarea.current?.focus({ preventScroll: true });
  }, [entries, pending]);
  useEffect(() => () => active.current?.abort(), []);
  const last = entries.findLast((entry) => entry.role === "assistant");
  const reply = last?.role === "assistant" ? last.reply : null;
  function choose(text: string) {
    setDraft(text);
    textarea.current?.focus();
  }
  async function send() {
    const text = draft.trim();
    if (!text || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setPending(text);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          messages: [...history(entries), { role: "user", content: text }],
        }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Не удалось получить ответ.");
      const answer = body as AssistantReply;
      setEntries((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: "user", text },
        { id: answer.id, role: "assistant", reply: answer },
      ]);
      onCityChange(answer.city);
      setDraft("");
    } catch (cause) {
      setError(
        controller.signal.aborted
          ? "Запрос отменён. Текст сохранён — можно отправить снова."
          : cause instanceof Error
            ? cause.message
            : "Ошибка соединения. Попробуйте ещё раз.",
      );
    } finally {
      active.current = null;
      setBusy(false);
      setPending("");
    }
  }
  return (
    <div className="workspace-grid assistant-workspace">
      <section className="chat-panel" aria-labelledby="assistant-title">
        <div className="panel-heading">
          <div className="assistant-avatar">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="assistant-title">Ваш помощник</h2>
            <p>Каталог EKT · Русский / Қазақша</p>
          </div>
          <span className="live-label">Подключён</span>
        </div>
        <div
          className={`conversation ${!entries.length && !pending ? "conversation-empty" : ""}`}
          ref={log}
          role="log"
          aria-label="Диалог с помощником"
          aria-live="polite"
        >
          {!entries.length && !pending && (
            <div className="chat-content">
              <div className="welcome-symbol">
                <Package size={34} />
                <span>
                  <Sparkles size={13} />
                </span>
              </div>
              <h3>С чего начнём закупку?</h3>
              <p className="welcome-copy">
                Напишите артикул или опишите товар своими словами.
                <br />
                Проверю наличие и покажу, на что обратить внимание при замене.
              </p>
              <div className="example-list">
                {examples.map((example, index) => (
                  <button
                    key={example.label}
                    onClick={() => choose(example.text)}
                  >
                    <span className="example-number">0{index + 1}</span>
                    <span>{example.label}</span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              <div className="phase-note">
                <span className="phase-dot" />
                <p>
                  В прототипе — выборка из 200 реальных товаров. Начните,
                  например, с артикула 027228 или 007886.
                </p>
              </div>
            </div>
          )}
          {entries.map((entry) =>
            entry.role === "user" ? (
              <div key={entry.id} className="user-message">
                {entry.text}
              </div>
            ) : (
              <div key={entry.id} className="assistant-message">
                <div className="message-label">
                  <Sparkles size={13} /> Комплект AI{" "}
                  <span>{entry.reply.city}</span>
                </div>
                <p className="assistant-answer">{entry.reply.text}</p>
                {entry.reply.notices.map((notice, i) => (
                  <p className="answer-notice" key={i}>
                    <AlertTriangle size={15} />
                    {notice}
                  </p>
                ))}
                {entry.reply.cards.map((card) => (
                  <ResultCard
                    key={card.product.id}
                    card={card}
                    city={entry.reply.city}
                  />
                ))}
                {entry.reply.terms.map((term) => (
                  <div className="terms-card" key={term.title}>
                    <h3>{term.title}</h3>
                    <p>{term.text}</p>
                    <a
                      className="source-link"
                      href={term.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Условия EKT · проверено {term.checkedAt}{" "}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            ),
          )}
          {pending && (
            <>
              <div className="user-message">{pending}</div>
              <div className="assistant-loading" role="status">
                <LoaderCircle size={17} className="spinning" />
                <div>
                  Разбираю запрос и проверяю каталог…
                  <small>
                    Если EKT отвечает медленно, проверка займёт больше времени.
                  </small>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="composer-area">
          {reply && !busy && (
            <div className="followup-chips">
              {reply.suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => choose(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="chat-error" role="alert">
              {error}
            </div>
          )}
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="request-draft">
              Сообщение помощнику
            </label>
            <textarea
              id="request-draft"
              ref={textarea}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={busy}
              placeholder="Например: нужны 10 автоматов 027228 в Алматы…"
              maxLength={4000}
              rows={2}
            />
            <div className="composer-bottom">
              <span className="attachment-hint">
                До 4 позиций за запрос · Shift + Enter — новая строка
              </span>
              {busy ? (
                <button
                  type="button"
                  className="cancel-chat"
                  onClick={() => active.current?.abort()}
                  aria-label="Отменить запрос"
                >
                  <X size={17} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="send-button"
                  disabled={!draft.trim()}
                  aria-label="Отправить сообщение"
                >
                  <Send size={17} />
                </button>
              )}
            </div>
          </form>
          <p className="composer-caption">
            <ShieldCheck size={13} /> Данные из каталога · Корзина без
            подтверждения не меняется
          </p>
          <p className="chat-privacy">
            Текст запроса обрабатывается OpenAI. Не указывайте платёжные данные.
          </p>
        </div>
      </section>
      <aside className="order-panel verification-panel">
        <div className="order-header">
          <h2>Проверка подбора</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="verification-content">
          {reply ? (
            <>
              <p className="tiny-label">
                ПОСЛЕДНИЙ ОТВЕТ · {reply.city.toUpperCase()}
              </p>
              <div className="verification-number">
                {reply.cards.length}
                <span>карточек проверено</span>
              </div>
              <div className="verification-line">
                <Check size={16} />
                <span>Цена и наличие из API</span>
              </div>
              <div className="verification-line">
                <Check size={16} />
                <span>Источник и время получения</span>
              </div>
              <div className="verification-line">
                <AlertTriangle size={16} />
                <span>
                  {reply.cards.filter((c) => c.conflicts.length).length}{" "}
                  карточек с противоречиями
                </span>
              </div>
              <p className="source-note">
                Последний ответ: {(reply.elapsedMs / 1000).toFixed(1)} с.
                Доступность может измениться; резерв не создан.
              </p>
            </>
          ) : (
            <>
              <div className="welcome-symbol">
                <ShieldCheck size={30} />
              </div>
              <h3>Доверяй, но проверяй</h3>
              <p>
                У каждой цены — источник. У каждого варианта замены — сравнение.
                Противоречия в характеристиках покажем отдельно.
              </p>
            </>
          )}
          <div className="next-phase-note">
            <Package size={19} />
            <div>
              <strong>Корзина — следующий этап</strong>
              <p>
                Сейчас можно подобрать и сравнить товары. Ничего не добавляем и
                не резервируем.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

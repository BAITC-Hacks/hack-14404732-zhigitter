"use client";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/cart/types";
export const money = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₸`;
export async function cartPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/cart/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось проверить корзину.");
  return data as T;
}
export function CartConfirmation({
  quote,
  onClose,
  onConfirmed,
}: {
  quote: Quote;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await cartPost("confirm", {
        token: quote.token,
        confirmed: true,
        acknowledgeWarnings: ack,
      });
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Проверка не завершена.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="cart-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="cart-dialog-header">
        <div>
          <span className="tiny-label">ПРОВЕРЕНО ЧЕРЕЗ API EKT</span>
          <h2 id="confirm-title">Подтвердите состав корзины</h2>
        </div>
        <button
          className="cart-icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Закрыть подтверждение"
        >
          ×
        </button>
      </div>
      <p className="cart-muted">
        {quote.city} · Это весь состав после изменения. Предложение действует 5
        минут; при подтверждении проверим данные ещё раз.
      </p>
      <div className="quote-lines">
        {quote.lines.length ? (
          quote.lines.map((line, index) => (
            <article className="quote-line" key={`${line.productId}-${index}`}>
              <strong>{line.name}</strong>
              <p>
                {line.quantity} ед. × {money(line.unitPrice)}{" "}
                <b>{money(line.total)}</b>
              </p>
              <small>
                {line.allocations
                  .map((a) => `${a.storeName}: ${a.quantity} ед.`)
                  .join(" · ")}
              </small>
              <small>
                Источник: API EKT ·{" "}
                {new Date(line.fetchedAt).toLocaleTimeString("ru-RU")}
              </small>
            </article>
          ))
        ) : (
          <p>Все товары будут удалены из корзины.</p>
        )}
      </div>
      <div className="cart-total">
        <span>Товары, без доставки</span>
        <strong>{money(quote.total)}</strong>
      </div>
      {quote.warnings.length > 0 && (
        <div className="cart-warnings">
          {quote.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Я понимаю условия доставки и необходимость проверить совместимость
            замен.
          </label>
        </div>
      )}
      <p className="cart-muted">
        Это корзина прототипа. Подтверждение не резервирует товар и не
        отправляет заказ в EKT.
      </p>
      {error && (
        <p className="cart-error" role="alert">
          {error}
        </p>
      )}
      <div className="cart-actions">
        <button className="cart-secondary" onClick={onClose} disabled={busy}>
          Вернуться к подбору
        </button>
        <button
          className="cart-primary"
          disabled={busy || (quote.warnings.length > 0 && !ack)}
          onClick={() => void confirm()}
        >
          {busy
            ? "Перепроверяем…"
            : quote.lines.length
              ? "Подтверждаю состав"
              : "Подтверждаю очистку"}
        </button>
      </div>
    </dialog>
  );
}

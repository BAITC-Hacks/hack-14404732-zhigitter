"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, ShieldCheck } from "lucide-react";
import type { AssistantReply } from "@/lib/assistant/types";
import type { CartView, Quote } from "@/lib/cart/types";
import { buildSupplyOptions } from "@/lib/cart/options";
import { CartConfirmation, cartPost, money } from "./cart-confirmation";

export function ProposalPanel({
  reply,
  city,
}: {
  reply: AssistantReply | null;
  city: string;
}) {
  const primary = reply?.cards.filter((c) => !c.comparison) || [];
  const [quantities, setQuantities] = useState<Record<number, number>>({}),
    [selected, setSelected] = useState<Record<number, string>>({}),
    [quote, setQuote] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [cartCount, setCartCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/cart")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CartView | null) => {
        if (active && data) setCartCount(data.state.items.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [success]);
  const rows = primary.map((card) => {
    const wanted = quantities[card.product.id] ?? card.requestedQuantity ?? 1;
    const options = buildSupplyOptions(card, reply?.cards || [], wanted, city);
    const option =
      options.find((o) => o.id === selected[card.product.id]) || options[0];
    return { card, wanted, options, option };
  });
  const ready = rows.filter((row) => row.option?.covered === row.wanted).length,
    total = rows.reduce((sum, row) => sum + (row.option?.total || 0), 0),
    lines = rows.flatMap((row) => row.option?.lines || []);
  async function prepare() {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      setQuote(
        await cartPost<Quote>("quote", {
          city,
          operation: "append",
          items: lines,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось проверить предложение.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="order-panel proposal-panel">
      <div className="order-header">
        <h2>Ваш комплект</h2>
        <ShoppingBag size={19} />
      </div>
      <div className="proposal-content">
        {rows.length ? (
          <>
            <div className="proposal-summary">
              <span>
                Собрано {ready} из {rows.length} позиций
              </span>
              <strong>{money(total)}</strong>
              <small>
                Предварительно, без доставки
                {rows.length - ready > 0
                  ? ` · ${rows.length - ready} поз. не собраны полностью`
                  : ""}
              </small>
            </div>
            <div className="proposal-rows">
              {rows.map(({ card, wanted, options, option }) => (
                <article className="proposal-row" key={card.product.id}>
                  <strong>{card.product.name}</strong>
                  <label className="proposal-quantity">
                    Нужно, ед.
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      step="1"
                      value={Number.isNaN(wanted) ? "" : wanted}
                      onChange={(e) => {
                        setQuantities({
                          ...quantities,
                          [card.product.id]: e.target.valueAsNumber,
                        });
                        setSuccess(false);
                      }}
                    />
                  </label>
                  {options.length ? (
                    <fieldset className="supply-options">
                      <legend>Как собрать позицию</legend>
                      {options.map((o) => (
                        <label
                          key={o.id}
                          className={option?.id === o.id ? "is-selected" : ""}
                        >
                          <input
                            type="radio"
                            name={`supply-${card.product.id}`}
                            checked={option?.id === o.id}
                            onChange={() => {
                              setSelected({
                                ...selected,
                                [card.product.id]: o.id,
                              });
                              setSuccess(false);
                            }}
                          />
                          <span>
                            <b>{o.label}</b>
                            <small>{o.detail}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="proposal-blocked">
                      {card.conflicts.length
                        ? "В характеристиках противоречие. Добавление заблокировано до проверки поставщиком."
                        : "Нет проверенного варианта на это количество. Измените количество или запросите замену."}
                    </p>
                  )}
                  {option && option.covered < wanted && (
                    <p className="proposal-blocked">
                      Не собрано: {wanted - option.covered} ед.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <button
              className="cart-primary proposal-submit"
              disabled={busy || !lines.length || success}
              onClick={() => void prepare()}
            >
              {busy
                ? "Обновляем цены и остатки…"
                : success
                  ? "Добавлено в корзину"
                  : "Проверить и добавить"}
            </button>
            <p className="cart-muted">
              Добавим выбранные количества после вашего подтверждения.
              Неподобранные позиции останутся вне корзины.
            </p>
          </>
        ) : (
          <div className="proposal-empty">
            <ShieldCheck size={32} />
            <h3>От запроса — к комплекту</h3>
            <p>
              Укажите товары и количество. Здесь появятся готовые варианты со
              складов и итоговая стоимость.
            </p>
            <small>Например: «10 штук 027024 в Алматы».</small>
          </div>
        )}
        {error && (
          <p className="cart-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="cart-success" role="status">
            Состав подтверждён и сохранён. Товары не зарезервированы.
          </p>
        )}
        <Link href="/cart" className="cart-link">
          Открыть корзину{cartCount !== null ? ` · ${cartCount} поз.` : ""}
          <span aria-hidden>→</span>
        </Link>
        <p className="cart-muted">
          Корзина сохраняется в этом браузере на 7 дней.
        </p>
      </div>
      {quote && (
        <CartConfirmation
          key={quote.id}
          quote={quote}
          onClose={() => setQuote(null)}
          onConfirmed={() => {
            setQuote(null);
            setSuccess(true);
          }}
        />
      )}
    </aside>
  );
}

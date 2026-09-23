"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowLeft,
  RefreshCw,
  Copy,
  Download,
} from "lucide-react";
import type { CartSelection, CartView, Quote } from "@/lib/cart/types";
import { CartConfirmation, cartPost, money } from "./cart-confirmation";
import { specificationText } from "@/lib/cart/export";

async function readCart(): Promise<CartView> {
  const response = await fetch("/api/cart", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
export function CartPage() {
  const [cart, setCart] = useState<CartView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<Quote | null>(null),
    [amounts, setAmounts] = useState<Record<number, number>>({}),
    [exportStatus, setExportStatus] = useState("");
  async function copySpecification() {
    if (!cart) return;
    try {
      await navigator.clipboard.writeText(specificationText(cart));
      setExportStatus(
        "Спецификация скопирована — можно вставить в сообщение или документ.",
      );
    } catch {
      setExportStatus("Браузер не разрешил копирование. Скачайте CSV.");
    }
  }
  const load = useCallback(async () => {
    try {
      const data = await readCart();
      setError("");
      setCart(data);
      setAmounts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть корзину.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    readCart()
      .then((data) => {
        if (active) setCart(data);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Не удалось открыть корзину.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function prepare(items: CartSelection[]) {
    if (!cart) return;
    setBusy(true);
    setError("");
    try {
      setQuote(
        await cartPost<Quote>("quote", {
          city: cart.state.city,
          operation: "replace",
          items,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Проверка не завершена.");
    } finally {
      setBusy(false);
    }
  }
  const edited =
    cart?.state.items.map((item, index) => ({
      ...item,
      quantity: amounts[index] ?? item.quantity,
    })) || [];
  return (
    <main className="cart-page">
      <Link href="/" className="cart-back">
        <ArrowLeft size={17} /> Вернуться к помощнику
      </Link>
      <header className="cart-page-heading">
        <div>
          <span className="tiny-label">КОМПЛЕКТ AI · ПРОТОТИП</span>
          <h1>
            <ShoppingBag size={31} /> Ваша корзина
          </h1>
          <p>Сохранённый состав для закупки. Заказ в EKT ещё не оформлен.</p>
        </div>
        <button
          className="cart-secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={16} /> Обновить
        </button>
      </header>
      {error && (
        <p className="cart-error" role="alert">
          {error}
        </p>
      )}
      {!cart && !error && <p role="status">Открываем корзину…</p>}
      {cart && (
        <>
          <div className="cart-page-summary">
            <div>
              <small>
                {cart.state.city} · {cart.items.length} позиций
              </small>
              <strong>{money(cart.total)}</strong>
            </div>
            <p>
              Цены на момент подтверждения, без доставки.
              <br />
              {cart.state.confirmedAt
                ? `Подтверждено: ${new Date(cart.state.confirmedAt).toLocaleString("ru-RU")}`
                : "Корзина пока пуста"}
            </p>
          </div>
          {cart.items.length ? (
            <>
              <div className="export-actions">
                <button
                  className="cart-secondary"
                  onClick={() => void copySpecification()}
                >
                  <Copy size={16} />
                  Скопировать спецификацию
                </button>
                <a className="cart-secondary" href="/api/cart/export" download>
                  <Download size={16} />
                  Скачать CSV
                </a>
              </div>
              <p className="cart-muted">
                Экспортируется сохранённый состав. Изменённые количества сначала
                подтвердите кнопкой ниже.
              </p>
              {exportStatus && (
                <p className="export-status" role="status">
                  {exportStatus}
                </p>
              )}
              <div className="saved-cart-lines">
                {cart.items.map(({ saved, product, issue }, index) => (
                  <article
                    key={`${saved.productId}-${index}`}
                    className="saved-cart-line"
                  >
                    <div>
                      <small>
                        {product?.article || `ID ${saved.productId}`}
                      </small>
                      <h2>
                        {product?.name || "Данные товара временно недоступны"}
                      </h2>
                      <p>
                        Склады: {saved.sourceCity || "несколько городов"}
                        {saved.originalId ? " · выбран кандидат на замену" : ""}
                      </p>
                      {product && (
                        <small>
                          API EKT · проверено{" "}
                          {new Date(product.fetchedAt).toLocaleString("ru-RU")}
                          {product.url && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                href={product.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Карточка EKT ↗
                              </a>
                            </>
                          )}
                        </small>
                      )}
                      {issue && <p className="proposal-blocked">{issue}</p>}
                    </div>
                    <div className="saved-cart-controls">
                      <label>
                        Количество
                        <input
                          aria-label={`Количество ${product?.article || saved.productId}`}
                          type="number"
                          min="1"
                          max="100000"
                          value={
                            Number.isNaN(amounts[index])
                              ? ""
                              : (amounts[index] ?? saved.quantity)
                          }
                          onChange={(e) =>
                            setAmounts({
                              ...amounts,
                              [index]: e.target.valueAsNumber,
                            })
                          }
                        />
                      </label>
                      <strong>{money(saved.unitPrice * saved.quantity)}</strong>
                      <small>{money(saved.unitPrice)} / ед.</small>
                      <button
                        className="cart-remove"
                        disabled={busy}
                        onClick={() =>
                          void prepare(
                            cart.state.items.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Удалить…
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="cart-actions">
                <button
                  className="cart-secondary"
                  disabled={busy}
                  onClick={() => void prepare([])}
                >
                  Очистить корзину…
                </button>
                <button
                  className="cart-primary"
                  disabled={busy}
                  onClick={() => void prepare(edited)}
                >
                  {busy ? "Проверяем через API…" : "Перепроверить и сохранить"}
                </button>
              </div>
            </>
          ) : (
            <div className="cart-empty">
              <ShoppingBag size={40} />
              <h2>Соберём первый комплект?</h2>
              <p>Напишите помощнику артикул и нужное количество.</p>
              <Link href="/" className="cart-primary">
                Начать подбор
              </Link>
            </div>
          )}
          <p className="cart-page-note">
            Корзина хранится только в этом браузере. Ссылка /cart не передаёт её
            другим людям. Остатки не зарезервированы; доставка и совместимость
            замен согласуются с поставщиком.
          </p>
        </>
      )}
      {quote && (
        <CartConfirmation
          key={quote.id}
          quote={quote}
          onClose={() => setQuote(null)}
          onConfirmed={() => {
            setQuote(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

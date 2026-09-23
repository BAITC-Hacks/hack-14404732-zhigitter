"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ExternalLink,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { cityStock } from "@/lib/catalog/normalize";
import type {
  CatalogSearchResult,
  ProductDetail,
  ProductSummary,
} from "@/lib/catalog/types";

function money(value: number | null) {
  return value === null
    ? "Цена не указана"
    : `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}
function time(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
}
function ProductPhoto({ product }: { product: ProductSummary }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-photo">
      {product.image && !failed ? (
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 720px) 45vw, 280px"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span>
          <Package size={36} />
          <small>Фото не предоставлено</small>
        </span>
      )}
    </div>
  );
}

function ProductDetails({ id, city }: { id: number; city: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog/${id}${version ? "?refresh=1" : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Не удалось получить данные");
        return body as ProductDetail;
      })
      .then((value) => {
        setProduct(value);
        setLoading(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, version]);
  function refresh() {
    setLoading(true);
    setError("");
    setProduct(null);
    setVersion((value) => value + 1);
  }
  if (loading)
    return (
      <div className="catalog-state" role="status">
        <RefreshCw className="spinning" size={24} />
        <p>Запрашиваем цену и остатки у ekt.kz…</p>
      </div>
    );
  if (error || !product)
    return (
      <div className="catalog-state" role="alert">
        <p>{error || "Карточка недоступна"}</p>
        <button className="outline-button" onClick={refresh}>
          Повторить запрос
        </button>
      </div>
    );
  const local = cityStock(product, city);
  const stocks = product.stores.filter(
    (store) =>
      !store.excluded && (store.quantity === null || store.quantity > 0),
  );
  const excluded = product.stores.filter(
    (store) =>
      store.excluded && (store.quantity === null || store.quantity > 0),
  );
  return (
    <>
      <div className="detail-top">
        <ProductPhoto key={product.id} product={product} />
        <div>
          <p className="product-article">
            АРТИКУЛ {product.article || "не указан"}
          </p>
          <h2 id="product-dialog-title">{product.name}</h2>
          <p className="detail-price">{money(product.price)}</p>
          <p className="source-note">
            Цена из API ekt.kz · {time(product.fetchedAt)} (UTC+5)
          </p>
          {product.url && (
            <a
              className="source-link"
              href={product.url}
              target="_blank"
              rel="noreferrer"
            >
              Карточка на ekt.kz <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
      <div className="stock-summary">
        <div>
          <span>{city}</span>
          <strong>{local === null ? "Нет данных" : local}</strong>
          <small>по городским складам</small>
        </div>
        <div>
          <span>Общий остаток API</span>
          <strong>{product.totalQuantity ?? "Нет данных"}</strong>
          <small>может включать технические склады</small>
        </div>
      </div>
      <section className="detail-section">
        <div className="detail-section-heading">
          <h3>Наличие по складам</h3>
          <button className="text-button" onClick={refresh}>
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
        <p className="source-note">
          Источник: API ekt.kz · {time(product.fetchedAt)} (UTC+5). Остатки не
          являются резервом. Срок перемещения между городами не указан.
        </p>
        {stocks.length ? (
          <ul className="store-list">
            {stocks.map((store) => (
              <li key={store.id}>
                <span>{store.name}</span>
                <strong>{store.quantity ?? "Нет данных"}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-copy">
            {product.stocksKnown
              ? "На обычных складах положительные остатки не указаны."
              : "Разбивка по складам не предоставлена."}
          </p>
        )}
        {excluded.length > 0 && (
          <details>
            <summary>Технические склады — не учитываем в доступности</summary>
            <ul className="store-list">
              {excluded.map((store) => (
                <li key={store.id}>
                  <span>{store.name}</span>
                  <strong>{store.quantity ?? "Нет данных"}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="detail-section">
        <h3>Характеристики из каталога</h3>
        {product.attributes.length ? (
          <dl className="attribute-list">
            {product.attributes.map((attribute) => (
              <div key={attribute.key}>
                <dt>{attribute.label}</dt>
                <dd>{attribute.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted-copy">Характеристики не предоставлены.</p>
        )}
        <p className="source-note">
          Поля показаны как в API. При расхождении с описанием параметры требуют
          проверки.
        </p>
      </section>
      {product.description && (
        <section className="detail-section">
          <h3>Описание поставщика</h3>
          <p className="product-description">{product.description}</p>
        </section>
      )}
      <section className="detail-section">
        <h3>Документы</h3>
        {product.certificates.length ? (
          product.certificates.map((cert) => (
            <a
              key={cert.url}
              className="source-link"
              href={cert.url}
              target="_blank"
              rel="noreferrer"
            >
              {cert.label} <ExternalLink size={14} />
            </a>
          ))
        ) : (
          <p className="muted-copy">
            Ссылка на сертификат в данных API не найдена.
          </p>
        )}
      </section>
    </>
  );
}

export function CatalogBrowser({ city }: { city: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductSummary | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog?q=${encodeURIComponent(query)}&page=${page}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить каталог");
        return (await response.json()) as CatalogSearchResult;
      })
      .then((value) => {
        setResult(value);
        setLoading(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, page]);
  useEffect(() => {
    if (selected) {
      dialog.current?.showModal();
      const before = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = before;
      };
    }
    dialog.current?.close();
  }, [selected]);
  function search(value: string) {
    setInput(value);
    if (query === value.trim() && page === 1) return;
    setLoading(true);
    setError("");
    setQuery(value.trim());
    setPage(1);
  }
  function changePage(value: number) {
    setLoading(true);
    setError("");
    setPage(value);
  }
  return (
    <section className="catalog-panel" aria-label="Каталог товаров">
      <div className="catalog-toolbar">
        <form
          className="catalog-search"
          onSubmit={(event) => {
            event.preventDefault();
            search(input);
          }}
        >
          <Search size={20} />
          <label className="sr-only" htmlFor="catalog-query">
            Название или артикул товара
          </label>
          <input
            id="catalog-query"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={160}
            placeholder="Название, артикул или код производителя"
          />
          <button type="submit">
            Найти <ArrowRight size={16} />
          </button>
        </form>
        <div className="search-examples">
          <span>Например:</span>
          {["027228", "Legrand", "коробка"].map((example) => (
            <button key={example} onClick={() => search(example)}>
              {example}
            </button>
          ))}
          {query && (
            <button onClick={() => search("")}>
              Сбросить <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="catalog-meta">
        <h2>
          {query
            ? `Результаты поиска${result && !loading ? ` · ${result.total}` : ""}`
            : "Товары для вашей закупки"}
        </h2>
        <span>Выборка: {result?.sampleSize ?? 200} товаров ekt.kz</span>
      </div>
      {loading ? (
        <div className="catalog-state" role="status">
          Загружаем каталог…
        </div>
      ) : error ? (
        <div className="catalog-state" role="alert">
          {error}. Обновите страницу.
        </div>
      ) : (
        result && (
          <>
            {result.products.length ? (
              <div className="product-grid">
                {result.products.map((product) => (
                  <button
                    key={product.id}
                    className="product-card"
                    onClick={() => setSelected(product)}
                    aria-label={`Открыть ${product.name}`}
                  >
                    <ProductPhoto product={product} />
                    <div className="product-card-body">
                      <p className="product-article">
                        {product.article || `ID ${product.id}`}
                      </p>
                      <h3>{product.name}</h3>
                      <strong className="product-price">
                        {money(product.price)}
                      </strong>
                      <span className="product-card-action">
                        Проверить наличие <ArrowRight size={15} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="catalog-state">
                <Package size={30} />
                <h3>В этой выборке ничего не найдено</h3>
                <p>
                  Попробуйте артикул или часть названия. Здесь представлены
                  первые 200 товаров, а не весь каталог поставщика.
                </p>
                <button className="outline-button" onClick={() => search("")}>
                  Показать все товары
                </button>
              </div>
            )}
            <div className="catalog-bottom">
              <p className="source-note">
                Цены в списке: снимок API от {time(result.syncedAt)} (UTC+5).
                <br />
                Откройте товар для актуальной цены и остатков.
              </p>
              {result.total > result.pageSize && (
                <nav className="pagination" aria-label="Страницы каталога">
                  <button
                    disabled={page === 1}
                    onClick={() => changePage(page - 1)}
                    aria-label="Предыдущая страница"
                  >
                    ←
                  </button>
                  <span>
                    {page} / {Math.ceil(result.total / result.pageSize)}
                  </span>
                  <button
                    disabled={page * result.pageSize >= result.total}
                    onClick={() => changePage(page + 1)}
                    aria-label="Следующая страница"
                  >
                    →
                  </button>
                </nav>
              )}
            </div>
          </>
        )
      )}
      <dialog
        ref={dialog}
        className="product-dialog"
        aria-label={selected?.name || "Карточка товара"}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
      >
        <div className="dialog-heading">
          <span>КАРТОЧКА ТОВАРА · EKT.KZ</span>
          <button
            aria-label="Закрыть карточку"
            onClick={() => setSelected(null)}
          >
            <X size={22} />
          </button>
        </div>
        {selected && (
          <ProductDetails key={selected.id} id={selected.id} city={city} />
        )}
      </dialog>
    </section>
  );
}

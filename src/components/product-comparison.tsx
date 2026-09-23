"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Columns2, LoaderCircle, X } from "lucide-react";
import type { ProductDetail, ProductSummary } from "@/lib/catalog/types";
import { cityStock } from "@/lib/catalog/normalize";
import {
  compareProducts,
  detectConflicts,
  extractSpecs,
  saleStock,
} from "@/lib/assistant/facts";
import { comparePrices } from "@/lib/assistant/price-comparison";

type Picked = Pick<ProductSummary, "id" | "article" | "name">;
const ComparisonContext = createContext<{
  selected: Picked[];
  toggle: (product: Picked) => void;
} | null>(null);
const money = (value: number | null) =>
  value === null
    ? "Нет цены"
    : `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
const shown = (value: string | number | null | undefined) =>
  value ?? "Нет данных";

export function CompareButton({ product }: { product: Picked }) {
  const context = useContext(ComparisonContext);
  if (!context) return null;
  const selected = context.selected.some((p) => p.id === product.id);
  return (
    <button
      type="button"
      className="compare-pick"
      aria-pressed={selected}
      disabled={!selected && context.selected.length === 2}
      title={
        !selected && context.selected.length === 2
          ? "Уберите один товар из сравнения, чтобы выбрать другой"
          : undefined
      }
      aria-label={`${selected ? "Убрать из сравнения" : "Сравнить"}: ${product.name}`}
      onClick={() => context.toggle(product)}
    >
      {selected ? <Check size={16} /> : <Columns2 size={16} />}
      {selected ? "В сравнении" : "Сравнить"}
    </button>
  );
}

export function ComparisonProvider({
  city,
  children,
}: {
  city: string;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Picked[]>([]);
  const [open, setOpen] = useState(false);
  function toggle(product: Picked) {
    setSelected((current) =>
      current.some((p) => p.id === product.id)
        ? current.filter((p) => p.id !== product.id)
        : current.length < 2
          ? [
              ...current,
              { id: product.id, article: product.article, name: product.name },
            ]
          : current,
    );
  }
  return (
    <ComparisonContext.Provider value={{ selected, toggle }}>
      <div
        className={
          selected.length ? "compare-root has-selection" : "compare-root"
        }
      >
        {children}
        {selected.length > 0 && (
          <aside
            className="compare-tray"
            aria-label="Выбранные товары для сравнения"
          >
            <div className="compare-tray-label" aria-live="polite">
              <Columns2 size={19} />
              <strong>{selected.length} из 2</strong>
              <span>
                {selected.length === 1
                  ? "Выберите второй товар"
                  : "Готово к сравнению"}
              </span>
            </div>
            <div className="compare-selected">
              {selected.map((p) => (
                <button
                  key={p.id}
                  title={p.name}
                  onClick={() => toggle(p)}
                  aria-label={`Убрать ${p.article} из сравнения`}
                >
                  <span>{p.article}</span>
                  <X size={14} />
                </button>
              ))}
            </div>
            <button
              className="compare-open"
              disabled={selected.length !== 2}
              onClick={() => setOpen(true)}
            >
              Сравнить цены
            </button>
            <button
              className="compare-clear"
              aria-label="Очистить сравнение"
              onClick={() => setSelected([])}
            >
              <X size={20} />
            </button>
          </aside>
        )}
        {open && selected.length === 2 && (
          <ComparisonDialog
            key={`${selected.map((p) => p.id).join("-")}-${city}`}
            selected={selected}
            city={city}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </ComparisonContext.Provider>
  );
}

function ComparisonDialog({
  selected,
  city,
  onClose,
}: {
  selected: Picked[];
  city: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [products, setProducts] = useState<ProductDetail[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ids = selected.map((p) => p.id).join(",");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ids.split(",").map(async (id) => {
        const response = await fetch(`/api/catalog/${id}?refresh=1`, {
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Не удалось обновить цены");
        return body as ProductDetail;
      }),
    )
      .then(setProducts)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [ids, attempt]);
  return (
    <dialog
      ref={dialog}
      className="price-compare-dialog"
      aria-labelledby="compare-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <header className="compare-heading">
        <div>
          <span>ВЫБИРАЕМ ПО ФАКТАМ</span>
          <h2 id="compare-title">Сравнение двух товаров</h2>
          <p>Актуальные цены и остатки · {city}</p>
        </div>
        <button autoFocus aria-label="Закрыть сравнение" onClick={onClose}>
          <X />
        </button>
      </header>
      {error ? (
        <div className="compare-loading" role="alert">
          <p>{error}</p>
          <button
            className="outline-button"
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Повторить
          </button>
        </div>
      ) : !products ? (
        <div className="compare-loading" role="status">
          <LoaderCircle className="compare-spinner" /> Обновляем оба товара из
          EKT…
        </div>
      ) : (
        <ComparisonDetails products={products} city={city} />
      )}
    </dialog>
  );
}

function ComparisonDetails({
  products,
  city,
}: {
  products: ProductDetail[];
  city: string;
}) {
  const [a, b] = products;
  const price = comparePrices(a, b);
  const compatibility = compareProducts(a, b);
  const specs = products.map(extractSpecs);
  const conflicts = products.map(detectConflicts);
  const rows: {
    label: string;
    values: (string | number | null)[];
    emphasis?: boolean;
  }[] = [
    {
      label: "Цена из API",
      values: products.map((p) => money(p.price)),
      emphasis: true,
    },
    { label: "Единица продажи", values: products.map((p) => p.unit) },
    {
      label: `В наличии · ${city}`,
      values: products.map((p) => cityStock(p, city)),
    },
    { label: "Всего без технических складов", values: products.map(saleStock) },
    {
      label: "Номинальный ток, А",
      values: specs.map((s, i) =>
        conflicts[i].length
          ? `${s.current ?? "?"} / ${s.propertyCurrent ?? "?"} — расхождение`
          : s.current,
      ),
    },
    { label: "Полюса по маркировке", values: specs.map((s) => s.poles) },
    {
      label: "Отключающая способность, кА",
      values: specs.map((s) => s.breaking),
    },
    { label: "Напряжение, В", values: specs.map((s) => s.voltage) },
    { label: "Ток утечки, мА", values: specs.map((s) => s.leakage) },
    { label: "Характеристика срабатывания", values: specs.map((s) => s.curve) },
    { label: "Число проводников", values: specs.map((s) => s.wires) },
  ];
  return (
    <>
      <div className="compare-price-summary">
        <strong>
          {price.difference === null
            ? "Не хватает данных о цене"
            : price.difference === 0
              ? "Цены одинаковые"
              : `Разница цен: ${money(price.difference)}`}
        </strong>
        {price.cheaperId && (
          <p>
            Ниже цена у артикула{" "}
            {products.find((p) => p.id === price.cheaperId)!.article}.
          </p>
        )}
        <small>{price.note}</small>
        {conflicts.some((items) => items.length > 0) && (
          <p className="compare-conflict">
            Есть противоречие в характеристиках поставщика. Не выбирайте замену
            только по цене.
          </p>
        )}
      </div>
      <div className="compare-table-wrap">
        <table className="price-compare-table">
          <caption className="sr-only">
            Цены, остатки и характеристики товаров из EKT
          </caption>
          <thead>
            <tr>
              <th scope="col">Что сравниваем</th>
              {products.map((p) => (
                <th scope="col" key={p.id}>
                  <ComparisonPhoto product={p} />
                  <span className="product-article">{p.article}</span>
                  <h3>{p.name}</h3>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={
                  row.emphasis
                    ? "compare-price-row"
                    : row.values[0] !== row.values[1]
                      ? "compare-different"
                      : ""
                }
              >
                <th scope="row">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{shown(v)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Проверка данных</th>
              {conflicts.map((items, i) => (
                <td key={i}>
                  {items.length
                    ? items.map((c) => (
                        <p className="compare-conflict" key={c.field}>
                          {c.nameValue}; {c.propertyValue}. Нужно уточнить.
                        </p>
                      ))
                    : "Противоречий номинала не обнаружено"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Источник и время проверки</th>
              {products.map((p) => (
                <td key={p.id}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      Карточка EKT ↗
                    </a>
                  ) : (
                    "API ekt.kz"
                  )}
                  <br />
                  <small>
                    {new Date(p.fetchedAt).toLocaleString("ru-RU", {
                      timeZone: "Asia/Almaty",
                    })}{" "}
                    (UTC+5)
                  </small>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <section className="compare-compatibility">
        <h3>
          {!compatibility || compatibility.blocked
            ? "Замену нельзя подтвердить"
            : "Параметры частично совпадают"}
        </h3>
        {!compatibility ? (
          <p>
            Товары различаются по назначению или ключевым параметрам, либо
            данных недостаточно. Разница цен не означает, что один заменяет
            другой.
          </p>
        ) : (
          <>
            <p>{compatibility.matches.join(" · ")}</p>
            {compatibility.differences.length > 0 && (
              <p>Различия: {compatibility.differences.join("; ")}</p>
            )}
            <p>Нужно проверить: {compatibility.unknowns.join("; ")}.</p>
          </>
        )}
        <small>
          Наличие не является резервом. Срок и стоимость доставки нужно
          подтвердить у поставщика.
        </small>
      </section>
    </>
  );
}

function ComparisonPhoto({ product }: { product: ProductDetail }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="compare-photo">
      {product.image && !failed ? (
        <Image
          src={product.image}
          alt=""
          fill
          sizes="100px"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <Columns2 size={28} />
      )}
    </div>
  );
}

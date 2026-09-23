"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Grid2X2,
  MapPin,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { CatalogBrowser } from "./catalog-browser";
import { AssistantChat } from "./assistant-chat";
import { AssistantAvatar } from "./assistant-avatar";
import { ComparisonProvider } from "./product-comparison";
import { cities } from "@/lib/assistant/types";

export function ProcurementWorkspace() {
  const [city, setCity] = useState("Алматы");
  const [view, setView] = useState<"catalog" | "assistant">("assistant");
  const [searchDraft, setSearchDraft] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  function openAssistant() {
    setView("assistant");
    requestAnimationFrame(() =>
      document.getElementById("request-draft")?.focus(),
    );
  }
  return (
    <ComparisonProvider city={city}>
      <div className="app-shell storefront-shell">
        <a className="skip-link" href="#workspace">
          Перейти к рабочему пространству
        </a>
        <div className="store-service-bar">
          <div className="store-service-inner">
            <label className="store-city">
              <MapPin size={15} aria-hidden="true" />
              <span className="sr-only">Город закупки</span>
              <select
                value={city}
                onChange={(event) => setCity(event.target.value)}
              >
                {cities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </label>
            <nav className="store-service-links" aria-label="Информация EKT">
              <a href="https://ekt.kz/about/" target="_blank" rel="noreferrer">
                О поставщике
              </a>
              <a
                href="https://ekt.kz/checkout-delivery/"
                target="_blank"
                rel="noreferrer"
              >
                Доставка и оплата ↗
              </a>
            </nav>
            <span className="store-prototype">Прототип · HackAlem AI</span>
          </div>
        </div>
        <header className="store-header">
          <div className="store-header-inner">
            <Link
              href="/"
              className="store-brand"
              aria-label="Комплект AI — главная"
            >
              <span>ЭЛЕКТРОТЕХНИКА</span>
              <strong>
                комплект<span>AI</span>
              </strong>
              <small>по каталогу EKT</small>
            </Link>
            <button
              className="store-catalog-button"
              type="button"
              aria-label="Открыть каталог товаров"
              onClick={() => setView("catalog")}
            >
              <Grid2X2 size={19} aria-hidden="true" />
              <span>Каталог</span>
            </button>
            <form
              className="store-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setCatalogQuery(searchDraft.trim());
                setSearchVersion((version) => version + 1);
                setView("catalog");
              }}
            >
              <Search size={19} aria-hidden="true" />
              <label className="sr-only" htmlFor="store-search-query">
                Поиск по каталогу
              </label>
              <input
                id="store-search-query"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Название, артикул или производитель"
                maxLength={160}
              />
              <button type="submit" aria-label="Найти в каталоге">
                <ArrowRight size={19} aria-hidden="true" />
              </button>
            </form>
            <button
              className="store-assistant-link"
              type="button"
              onClick={openAssistant}
              aria-label="Написать помощнику"
            >
              <AssistantAvatar size={35} />
              <span>Помощник</span>
            </button>
            <Link
              href="/cart"
              className="store-cart-link"
              aria-label="Открыть корзину"
            >
              <ShoppingBag size={22} aria-hidden="true" />
              <span>Корзина</span>
            </Link>
          </div>
        </header>
        <main id="workspace" className="main-content store-main" tabIndex={-1}>
          <div className="store-page-heading">
            <div>
              <p className="store-breadcrumb">
                Каталог EKT <span>/</span> Комплект AI
              </p>
              <h1>
                {view === "assistant"
                  ? "Ваш заказ начинается с диалога"
                  : "Электротехника для вашего проекта"}
              </h1>
              <p>
                {view === "assistant"
                  ? "Опишите задачу, приложите список или фото — проверим товары и соберём комплект."
                  : "Ищите товары, проверяйте наличие и сравнивайте характеристики."}
              </p>
            </div>
            <span className="store-data-note">
              <span />
              Цены и остатки из EKT
            </span>
          </div>
          <div className="workspace-toolbar store-toolbar">
            <nav className="workspace-tabs" aria-label="Рабочее пространство">
              <button
                type="button"
                aria-pressed={view === "assistant"}
                aria-controls="assistant-workspace"
                onClick={() => setView("assistant")}
              >
                <Sparkles size={16} aria-hidden="true" />
                Помощник
              </button>
              <button
                type="button"
                aria-pressed={view === "catalog"}
                aria-controls="catalog-workspace"
                onClick={() => setView("catalog")}
              >
                <Grid2X2 size={16} aria-hidden="true" />
                Каталог товаров
              </button>
            </nav>
            <p className="store-process">
              Подбор <span>→</span> Сравнение <span>→</span> Ваше подтверждение
            </p>
          </div>
          <div id="assistant-workspace" hidden={view !== "assistant"}>
            <AssistantChat city={city} onCityChange={setCity} />
          </div>
          <div id="catalog-workspace" hidden={view !== "catalog"}>
            {view === "catalog" && (
              <CatalogBrowser
                key={`${catalogQuery}:${searchVersion}`}
                city={city}
                initialQuery={catalogQuery}
              />
            )}
          </div>
          <footer className="site-footer store-footer">
            <span>Комплект AI · Zhigitter · Прототип для HackAlem AI</span>
            <a href="https://ekt.kz/" target="_blank" rel="noreferrer">
              Магазин ekt.kz <ArrowRight size={13} aria-hidden="true" />
            </a>
          </footer>
        </main>
        {view === "catalog" && (
          <button
            className="store-chat-launcher"
            type="button"
            onClick={openAssistant}
          >
            <AssistantAvatar size={42} />
            <span>
              <strong>Нужна помощь с выбором?</strong>
              <small>Спросите Комплект AI</small>
            </span>
          </button>
        )}
      </div>
    </ComparisonProvider>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { CatalogBrowser } from "./catalog-browser";
import { AssistantChat } from "./assistant-chat";
import { ComparisonProvider } from "./product-comparison";
import { cities } from "@/lib/assistant/types";

const buyingSteps = [
  { title: "Опишите задачу", detail: "Текст, список или фото товара" },
  { title: "Сравните варианты", detail: "Характеристики, цены и наличие" },
  { title: "Подтвердите корзину", detail: "Только после вашего решения" },
];

export function ProcurementWorkspace() {
  const [city, setCity] = useState("Алматы");
  const [view, setView] = useState<"catalog" | "assistant">("assistant");
  return (
    <ComparisonProvider city={city}>
      <div className="app-shell">
        <a className="skip-link" href="#workspace">
          Перейти к рабочему пространству
        </a>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Комплект AI — главная">
            <span className="brand-mark">
              <Zap
                size={23}
                fill="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
            <span>
              комплект<span className="brand-ai">AI</span>
            </span>
          </Link>
          <span className="header-caption">
            Электротехника для вашего проекта
          </span>
          <div className="header-actions">
            <label className="city-control">
              <MapPin size={16} aria-hidden="true" />
              <span className="city-caption" aria-hidden="true">
                Город закупки
              </span>
              <span className="sr-only">Город закупки</span>
              <select
                value={city}
                onChange={(event) => setCity(event.target.value)}
              >
                {cities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            <span className="prototype-badge">Прототип</span>
          </div>
        </header>
        <main id="workspace" className="main-content" tabIndex={-1}>
          <div className="page-intro">
            <div>
              <p className="eyebrow">
                <span /> ВАШ ПОМОЩНИК ПО ЗАКУПКАМ
              </p>
              <h1>
                Весь заказ.
                <br className="mobile-break" /> <span>В одном диалоге.</span>
              </h1>
              <p className="intro-text">
                Начните с названия, артикула, списка или фото. Найдём подходящие
                товары в каталоге EKT.
              </p>
            </div>
            <div className="intro-label">
              <ShieldCheck size={21} aria-hidden="true" />
              <div>
                <strong>По данным EKT</strong>
                <span>Цены · характеристики · наличие</span>
              </div>
            </div>
          </div>
          <ol className="buying-steps" aria-label="Как собрать заказ">
            {buyingSteps.map((step, index) => (
              <li key={step.title}>
                <span className="buying-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="workspace-toolbar">
            <nav className="workspace-tabs" aria-label="Рабочее пространство">
              <button
                type="button"
                aria-pressed={view === "assistant"}
                aria-controls="assistant-workspace"
                onClick={() => setView("assistant")}
              >
                <Sparkles size={16} aria-hidden="true" /> Помощник
              </button>
              <button
                type="button"
                aria-pressed={view === "catalog"}
                aria-controls="catalog-workspace"
                onClick={() => setView("catalog")}
              >
                <Package size={16} aria-hidden="true" /> Каталог
              </button>
            </nav>
            <p className="workspace-context">
              {view === "assistant"
                ? "Опишите задачу — подберём варианты"
                : "Ищите по названию или артикулу"}
            </p>
          </div>
          <div id="assistant-workspace" hidden={view !== "assistant"}>
            <AssistantChat city={city} onCityChange={setCity} />
          </div>
          <div id="catalog-workspace" hidden={view !== "catalog"}>
            {view === "catalog" && <CatalogBrowser city={city} />}
          </div>
          <footer className="site-footer">
            <span>Комплект AI · Zhigitter · HackAlem AI</span>
            <a href="https://ekt.kz/" target="_blank" rel="noreferrer">
              Каталог партнёра ekt.kz <ArrowRight size={13} />
            </a>
          </footer>
        </main>
      </div>
    </ComparisonProvider>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  Package,
  Sparkles,
  Zap,
} from "lucide-react";
import { CatalogBrowser } from "./catalog-browser";
import { AssistantChat } from "./assistant-chat";
import { cities } from "@/lib/assistant/types";

export function ProcurementWorkspace() {
  const [city, setCity] = useState("Алматы");
  const [view, setView] = useState<"catalog" | "assistant">("assistant");
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Перейти к помощнику
      </a>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Комплект AI — главная">
          <span className="brand-mark">
            <Zap size={23} fill="currentColor" strokeWidth={1.5} />
          </span>
          <span>
            комплект<span className="brand-ai">AI</span>
          </span>
        </Link>
        <span className="header-caption">Помощник по закупкам</span>
        <div className="header-actions">
          <label className="city-control">
            <MapPin size={16} />
            <span className="sr-only">Город закупки</span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              {cities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <span className="prototype-badge">Прототип</span>
        </div>
      </header>
      <main id="workspace" className="main-content">
        <div className="page-intro">
          <div>
            <p className="eyebrow">
              <span /> ЭЛЕКТРОТЕХНИКА · ЗАКУПКИ
            </p>
            <h1>
              Весь заказ.
              <br className="mobile-break" /> В одном диалоге.
            </h1>
            <p className="intro-text">
              Найдём товар, проверим наличие и сравним варианты по каталогу EKT.
            </p>
          </div>
          <div className="intro-label">
            <span className="tiny-label">HACKALEM AI</span>
            <span>
              Zhigitter <ArrowRight size={16} />
            </span>
          </div>
        </div>
        <nav className="workspace-tabs" aria-label="Рабочее пространство">
          <button
            aria-pressed={view === "assistant"}
            onClick={() => setView("assistant")}
          >
            <Sparkles size={16} /> Помощник
          </button>
          <button
            aria-pressed={view === "catalog"}
            onClick={() => setView("catalog")}
          >
            <Package size={16} /> Каталог
          </button>
        </nav>
        <div hidden={view !== "assistant"}>
          <AssistantChat city={city} onCityChange={setCity} />
        </div>
        {view === "catalog" && <CatalogBrowser city={city} />}
        <footer className="site-footer">
          <span>Комплект AI · Команда Zhigitter</span>
          <a href="https://ekt.kz/" target="_blank" rel="noreferrer">
            Каталог партнёра ekt.kz <ArrowRight size={13} />
          </a>
        </footer>
      </main>
    </div>
  );
}

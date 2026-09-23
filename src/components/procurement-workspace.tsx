"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CatalogBrowser } from "./catalog-browser";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  MapPin,
  Package,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const examples = [
  {
    label: "Найти по артикулу",
    text: "Найди товар по артикулу 200300285_. Нужны характеристики и наличие в Алматы.",
  },
  {
    label: "Подобрать замену",
    text: "Нужен аналог автоматического выключателя. Помоги уточнить параметры для подбора.",
  },
  {
    label: "Собрать по списку",
    text: "Помоги собрать заказ в Алматы:\n1. Артикул 200300285_ — 5 шт.\n2. Распределительная коробка — 10 шт.",
  },
];

export function ProcurementWorkspace() {
  const [draft, setDraft] = useState("");
  const [city, setCity] = useState("Алматы");
  const [view, setView] = useState<"catalog" | "assistant">("catalog");
  const textarea = useRef<HTMLTextAreaElement>(null);

  function chooseExample(text: string) {
    setDraft(text);
    textarea.current?.focus();
  }

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
              <option>Алматы</option>
              <option>Астана</option>
              <option>Шымкент</option>
              <option>Караганда</option>
              <option>Атырау</option>
              <option>Актау</option>
              <option>Тараз</option>
              <option>Талдыкорган</option>
              <option>Усть-Каменогорск</option>
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
              Место для вашего списка, подходящих товаров и понятных решений.
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
            aria-pressed={view === "catalog"}
            onClick={() => setView("catalog")}
          >
            <Package size={16} /> Каталог
          </button>
          <button
            aria-pressed={view === "assistant"}
            onClick={() => setView("assistant")}
          >
            <Sparkles size={16} /> Помощник <span>Скоро</span>
          </button>
        </nav>
        {view === "catalog" ? (
          <CatalogBrowser city={city} />
        ) : (
          <div className="workspace-grid">
            <section className="chat-panel" aria-labelledby="assistant-title">
              <div className="panel-heading">
                <div className="assistant-avatar">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 id="assistant-title">Ваш помощник</h2>
                  <p>Подбор по каталогу ekt.kz</p>
                </div>
                <span className="stage-label">Скоро</span>
              </div>
              <div className="chat-content">
                <div className="welcome-symbol">
                  <Package size={34} strokeWidth={1.35} />
                  <span>
                    <Sparkles size={13} />
                  </span>
                </div>
                <h3>С чего начнём закупку?</h3>
                <p className="welcome-copy">
                  Подготовьте список товаров или начните с артикула.
                  <br className="desktop-break" /> Здесь появятся подбор,
                  наличие и варианты замены.
                </p>
                <div className="example-list">
                  {examples.map((example, index) => (
                    <button
                      key={example.label}
                      type="button"
                      onClick={() => chooseExample(example.text)}
                    >
                      <span className="example-number">0{index + 1}</span>
                      <span>{example.label}</span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="phase-note">
                  <span className="phase-dot" />
                  <p>
                    Каталог уже подключён. Готовим AI-помощника; сейчас можно
                    составить черновик запроса.
                  </p>
                </div>
              </div>
              <div className="composer-area">
                <div className="composer">
                  <label className="sr-only" htmlFor="request-draft">
                    Ваш список товаров
                  </label>
                  <textarea
                    id="request-draft"
                    ref={textarea}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Например: нужны 10 автоматов на 160 А…"
                    maxLength={6000}
                    rows={3}
                  />
                  <div className="composer-bottom">
                    <span className="attachment-hint">
                      <Paperclip size={17} /> Файлы — на следующем этапе
                    </span>
                    <button
                      className="send-button"
                      disabled
                      aria-label="Отправка появится после подключения помощника"
                      title="Помощник ещё не подключён"
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </div>
                <p className="composer-caption">
                  <ShieldCheck size={13} /> Добавление в корзину — только с
                  вашего подтверждения
                </p>
              </div>
            </section>

            <aside className="order-panel" aria-labelledby="order-title">
              <div className="order-header">
                <h2 id="order-title">Ваше предложение</h2>
                <span className="count-badge">0</span>
              </div>
              <div className="order-empty">
                <span className="empty-icon">
                  <FileText size={29} strokeWidth={1.4} />
                </span>
                <h3>Здесь будет ваш заказ</h3>
                <p>
                  Товары, количество и стоимость
                  <br />
                  соберём в одном месте.
                </p>
                <div className="empty-lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="order-steps">
                <p className="tiny-label">КАК БУДЕТ РАБОТАТЬ ПОДБОР</p>
                {[
                  "Укажете, что нужно",
                  "Проверите товары и замены",
                  "Подтвердите корзину",
                ].map((step, index) => (
                  <div key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </div>
                ))}
              </div>
              <div className="order-footer">
                <Check size={16} />
                <p>
                  Цены и остатки доступны
                  <br />
                  во вкладке «Каталог».
                </p>
              </div>
            </aside>
          </div>
        )}
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

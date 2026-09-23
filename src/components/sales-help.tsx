"use client";
import { useState } from "react";
import {
  Check,
  Copy,
  Clock3,
  BadgeDollarSign,
  FileCheck2,
  HelpCircle,
} from "lucide-react";
import type { AssistantReply, SalesHelp } from "@/lib/assistant/types";

export function SalesHelpActions({
  reply,
  disabled,
  onChoose,
}: {
  reply: AssistantReply;
  disabled: boolean;
  onChoose: (text: string, help: SalesHelp) => void;
}) {
  const card = reply.cards.find((c) => !c.comparison);
  if (!card) return null;
  const options = [
    {
      kind: "budget" as const,
      label: "Дорого",
      text: "Помоги найти вариант дешевле с подходящими параметрами",
      Icon: BadgeDollarSign,
    },
    {
      kind: "urgent" as const,
      label: "Нужно срочно",
      text: "Помоги проверить местное наличие для срочной покупки",
      Icon: Clock3,
    },
    {
      kind: "approval" as const,
      label: "Согласовать закупку",
      text: "Подготовь текст для согласования закупки",
      Icon: FileCheck2,
    },
    {
      kind: "compatibility" as const,
      label: "Подойдёт ли мне?",
      text: "Помоги уточнить совместимость у менеджера",
      Icon: HelpCircle,
    },
  ];
  return (
    <section
      className="sales-help-actions"
      aria-label="Помощь с решением о покупке"
    >
      <div>
        <strong>Помочь с выбором?</strong>
        <span>
          Для {card.product.supplierArticle || card.product.article} · выберите,
          что нужно решить
        </span>
      </div>
      <div className="sales-action-buttons">
        {options.map(({ kind, label, text, Icon }) => (
          <button
            type="button"
            key={kind}
            disabled={disabled}
            onClick={() =>
              onChoose(text, {
                kind,
                productId: card.product.id,
                quantity: card.requestedQuantity,
              })
            }
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
export function SalesHelpAnswer({
  help,
}: {
  help: NonNullable<AssistantReply["salesHelp"]>;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="sales-help-answer">
      <h3>{help.title}</h3>
      <p>{help.summary}</p>
      {help.draft && (
        <>
          <details>
            <summary>Текст для отправки — проверить и скопировать</summary>
            <textarea
              readOnly
              value={help.draft}
              aria-label="Черновик для согласования или менеджера"
              rows={9}
            />
          </details>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(help.draft!);
                setCopied(true);
                setError("");
              } catch {
                setError(
                  "Не удалось скопировать автоматически. Выделите текст в поле выше.",
                );
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied ? "Скопировано" : "Скопировать текст"}
          </button>
          <span role="status">
            {error ||
              (copied
                ? "Текст скопирован. Отправьте его сами после проверки."
                : "Никому не отправлено")}
          </span>
        </>
      )}
    </section>
  );
}

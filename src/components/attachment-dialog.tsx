"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  FileText,
  LoaderCircle,
  Upload,
  ShieldCheck,
} from "lucide-react";
import type { AttachmentResult, ExtractedItem } from "@/lib/attachments/types";
import type { ImportedItem } from "@/lib/assistant/types";

async function preparePhoto(file: File): Promise<File> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Выберите фото до 15 МБ.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Выберите JPEG, PNG или WebP. HEIC сначала сохраните как JPEG.",
    );
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не смог подготовить фото.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Не удалось подготовить фото.")),
        "image/jpeg",
        0.92,
      ),
    );
    return new File([blob], "product-photo.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
export function AttachmentDialog({
  mode,
  city,
  onClose,
  onSearch,
  onDraft,
}: {
  mode: "photo" | "list";
  city: string;
  onClose: () => void;
  onSearch: (text: string, importItems?: ImportedItem[]) => void;
  onDraft: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    active = useRef<AbortController | null>(null),
    previewUrl = useRef("");
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<AttachmentResult | null>(null),
    [rows, setRows] = useState<ExtractedItem[]>([]),
    [quantity, setQuantity] = useState(1);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      active.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  function chooseFile(next: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next?.type.startsWith("image/")
      ? URL.createObjectURL(next)
      : "";
    setFile(next);
    setPreview(previewUrl.current);
    setResult(null);
    setRows([]);
    setError("");
  }
  async function analyze() {
    if (!file || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const prepared =
        mode === "photo" || file.type.startsWith("image/")
          ? await preparePhoto(file)
          : file;
      if (prepared.size > 3 * 1024 * 1024)
        throw new Error("Файл должен быть до 3 МБ после подготовки.");
      const form = new FormData();
      form.set("file", prepared);
      form.set("mode", mode);
      form.set("city", city);
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(59000),
        ]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Распознавание не завершено.");
      setResult(data);
      setRows(data.items);
      requestAnimationFrame(() => dialog.current?.scrollTo({ top: 0 }));
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    } finally {
      active.current = null;
      setBusy(false);
    }
  }
  const validQty = (value: number | null) =>
    value !== null &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 100000;
  const photo = result?.items[0];
  return (
    <dialog
      className="cart-dialog attachment-dialog"
      ref={dialog}
      aria-labelledby="attachment-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="cart-dialog-header">
        <div>
          <span className="tiny-label">
            {mode === "photo"
              ? "COMPUTER VISION · ПОИСК ПО ФОТО"
              : "ИМПОРТ СПИСКА ЗАКУПКИ"}
          </span>
          <h2 id="attachment-title">
            {mode === "photo"
              ? "Не знаете название товара?"
              : "Загрузите список — найдём товары"}
          </h2>
        </div>
        <button
          className="cart-icon-button"
          onClick={onClose}
          aria-label="Закрыть вложение"
        >
          ×
        </button>
      </div>
      <p className="attachment-intro">
        {mode === "photo"
          ? "Сфотографируйте товар и маркировку крупным планом. Покажем возможные совпадения из каталога EKT."
          : "PDF до 5 страниц, Word DOCX, Excel XLSX, TXT или CSV в UTF-8. До 4 позиций за подбор. Сначала проверите распознанный список."}
      </p>
      {!result && (
        <>
          <label className={`attachment-drop ${busy ? "is-busy" : ""}`}>
            <input
              type="file"
              aria-label={mode === "photo" ? "Фото товара" : "Файл со списком"}
              accept={
                mode === "photo"
                  ? "image/jpeg,image/png,image/webp"
                  : ".pdf,.docx,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp"
              }
              disabled={busy}
              onChange={(e) => chooseFile(e.target.files?.[0] || null)}
            />
            {preview ? (
              <Image
                src={preview}
                alt="Выбранное фото для распознавания"
                width={220}
                height={160}
                unoptimized
              />
            ) : mode === "photo" ? (
              <Camera size={34} />
            ) : (
              <FileText size={34} />
            )}
            <strong>{file?.name || "Выбрать файл"}</strong>
            <span>
              {mode === "photo"
                ? "JPEG, PNG, WebP · до 15 МБ · фото уменьшается перед отправкой"
                : "PDF / DOCX / XLSX / TXT / CSV до 3 МБ или фото списка"}
            </span>
          </label>
          <p className="attachment-privacy">
            Файл будет отправлен OpenAI для распознавания. На сайте его не
            сохраняем. Не загружайте документы с личными или платёжными данными.
          </p>
          <button
            className="cart-primary attachment-analyze"
            disabled={!file || busy}
            onClick={() => void analyze()}
          >
            {busy ? (
              <>
                <LoaderCircle size={17} className="spin" />
                Распознаём{mode === "photo" ? " и ищем кандидатов" : " список"}…
              </>
            ) : (
              <>
                <Upload size={17} />
                {mode === "photo" ? "Распознать и найти" : "Прочитать список"}
              </>
            )}
          </button>
        </>
      )}
      {error && (
        <p className="cart-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="attachment-result">
          {result.warning && (
            <p className="proposal-blocked">{result.warning}</p>
          )}
          {result.ignoredInstructions && (
            <p className="attachment-safety">
              <ShieldCheck size={17} />
              Распознавание обнаружило команды в файле и исключило их из списка.
              Корзина не изменена.
            </p>
          )}
          {result.truncated && (
            <p className="proposal-blocked">
              В файле больше 4 позиций. Здесь только первые четыре — остальные
              загрузите отдельным списком.
            </p>
          )}
          {mode === "photo" && photo && (
            <>
              <div className="vision-reading">
                <span className="tiny-label">ЧТО УДАЛОСЬ РАСПОЗНАТЬ</span>
                <h3>{photo.description}</h3>
                <p>
                  Маркировка: <b>{photo.marking || "не прочитана"}</b>
                </p>
                <small>{photo.evidence}</small>
              </div>
              <p className="cart-muted">
                {photo.uncertain ? "Есть неуверенность в распознавании. " : ""}
                Похожее изображение не подтверждает модель, номинал или
                совместимость. Сверьте маркировку перед выбором.
              </p>
              <label className="vision-quantity">
                Сколько нужно, ед.
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={Number.isNaN(quantity) ? "" : quantity}
                  onChange={(e) => setQuantity(e.target.valueAsNumber)}
                />
              </label>
              <div className="vision-candidates">
                {result.candidates.length ? (
                  <>
                    <h3>Возможные совпадения · выберите одно</h3>
                    {result.candidates.map((candidate) => (
                      <article className="vision-candidate" key={candidate.id}>
                        {candidate.image && (
                          <Image
                            src={candidate.image}
                            width={70}
                            height={70}
                            alt={candidate.name}
                          />
                        )}
                        <div>
                          <small>
                            {candidate.exactMarking
                              ? "Совпадение прочитанного кода"
                              : "Кандидат по распознанным признакам"}
                          </small>
                          <strong>{candidate.name}</strong>
                          <span>{candidate.article}</span>
                          <button
                            className="cart-secondary"
                            disabled={!validQty(quantity)}
                            onClick={() =>
                              onSearch(
                                `По фото я выбрал для проверки товар с артикулом ${candidate.article}: ${candidate.name}. Нужно ${quantity} шт. Проверь цену, наличие и противоречия в характеристиках. Выбор по фото сам по себе не подтверждает совместимость.`,
                                [{ query: candidate.article, quantity }],
                              )
                            }
                          >
                            Выбрать и проверить
                          </button>
                        </div>
                      </article>
                    ))}
                  </>
                ) : (
                  <p className="proposal-blocked">
                    Подходящий товар в выборке из 200 позиций не найден. Снимите
                    маркировку крупнее или уточните её в чате.
                  </p>
                )}
              </div>
              <button
                className="attachment-text-button"
                onClick={() =>
                  onDraft(
                    `Помоги уточнить товар по фото: ${photo.description}. Прочитанная маркировка: ${photo.marking || "не читается"}. ${photo.evidence}`,
                  )
                }
              >
                Уточнить распознавание в чате →
              </button>
            </>
          )}
          {mode === "list" && rows.length > 0 && (
            <>
              <h3>Проверьте позиции и количество</h3>
              <p className="cart-muted">
                Исправьте ошибки распознавания. Пустое количество нужно
                заполнить вручную.
              </p>
              <div className="import-rows">
                {rows.map((row, index) => (
                  <div className="import-row" key={index}>
                    <label>
                      Товар / маркировка
                      <input
                        value={row.marking || row.description}
                        maxLength={250}
                        onChange={(e) =>
                          setRows(
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    description: e.target.value,
                                    marking: "",
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Количество
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={
                          row.quantity === null || Number.isNaN(row.quantity)
                            ? ""
                            : row.quantity
                        }
                        onChange={(e) =>
                          setRows(
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, quantity: e.target.valueAsNumber }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="cart-icon-button"
                      aria-label={`Удалить строку ${index + 1} из списка`}
                      onClick={() =>
                        setRows(rows.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </button>
                    <small>
                      {row.description}
                      {row.uncertain ? " · требуется проверка" : ""}
                    </small>
                  </div>
                ))}
              </div>
              <button
                className="cart-primary attachment-analyze"
                disabled={
                  !rows.length ||
                  rows.some(
                    (r) =>
                      !(r.marking || r.description).trim() ||
                      !validQty(r.quantity),
                  )
                }
                onClick={() =>
                  onSearch(
                    `Найди позиции из проверенного мной списка. Для каждой покажи совпадение или явно сообщи, что она не найдена. Ничего не добавляй в корзину автоматически.\n${rows.map((r, i) => `${i + 1}. ${r.marking || r.description} — ${r.quantity} шт.`).join("\n")}`,
                    rows.map((row) => ({
                      query: row.marking || row.description,
                      quantity: row.quantity!,
                    })),
                  )
                }
              >
                Найти {rows.length} поз. в каталоге
              </button>
            </>
          )}
          {!result.items.length && (
            <p className="proposal-blocked">
              Не удалось выделить электротехнические товары. Попробуйте другой
              файл или более чёткое фото маркировки.
            </p>
          )}
          <p className="attachment-safety">
            <ShieldCheck size={16} />
            Распознавание и поиск не меняют корзину.
          </p>
          <button
            className="attachment-text-button"
            onClick={() => {
              setResult(null);
              setRows([]);
              setError("");
            }}
          >
            Выбрать другой файл / повторить
          </button>
        </div>
      )}
    </dialog>
  );
}

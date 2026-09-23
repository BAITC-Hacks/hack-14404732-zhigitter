import { fromBuffer } from "yauzl";
import { XMLParser } from "fast-xml-parser";

const MAX_EXPANDED = 8 * 1024 * 1024;
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const array = (v: unknown): unknown[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const scalar = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";

async function xmlEntries(bytes: Buffer): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zip) => {
        if (err || !zip)
          return reject(
            new Error(
              "Не удалось открыть Word/Excel. Возможно, файл повреждён или защищён паролем.",
            ),
          );
        let count = 0,
          total = 0,
          finished = false;
        const files = new Map<string, string>();
        const fail = (error: Error) => {
          if (finished) return;
          finished = true;
          zip.close();
          reject(error);
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (!finished) {
            finished = true;
            resolve(files);
          }
        });
        zip.on("entry", (entry) => {
          if (
            ++count > 500 ||
            (total += entry.uncompressedSize) > MAX_EXPANDED ||
            entry.isEncrypted()
          )
            return fail(
              new Error(
                "Слишком сложный или защищённый файл. До 8 МБ после распаковки и 500 внутренних файлов.",
              ),
            );
          // No filesystem writes, external relationships, macros or embedded objects are opened.
          if (
            !/^(word\/document\.xml|xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml))$/.test(
              entry.fileName,
            )
          ) {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream)
              return fail(new Error("Повреждённый документ."));
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on("data", (chunk) => {
              size += chunk.length;
              if (size > MAX_EXPANDED) {
                stream.destroy();
                fail(new Error("Превышен размер документа."));
                return;
              }
              chunks.push(chunk);
            });
            stream.on("error", fail);
            stream.on("end", () => {
              if (finished) return;
              const text = Buffer.concat(chunks).toString("utf8");
              if (/<!DOCTYPE|<!ENTITY/i.test(text))
                return fail(
                  new Error("XML с внешними сущностями не поддерживается."),
                );
              files.set(entry.fileName, text);
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
function richText(value: unknown): string {
  if (Array.isArray(value)) return value.map(richText).join("");
  if (typeof value !== "object" || !value) return scalar(value);
  const v = record(value);
  if (v.t !== undefined) return richText(v.t);
  if (v["#text"] !== undefined) return scalar(v["#text"]);
  if (v.r !== undefined) return richText(v.r);
  return "";
}
function wordText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return scalar(nodes);
  return nodes
    .map((node) =>
      Object.entries(record(node))
        .filter(([key]) => key !== ":@")
        .map(([key, value]) => {
          if (key === "#text") return scalar(value);
          if (key === "w:tab") return "\t";
          if (key === "w:tr")
            return (
              array(value)
                .filter((v) => record(v)["w:tc"] !== undefined)
                .map((v) =>
                  wordText(record(v)["w:tc"]).replace(/\s+/g, " ").trim(),
                )
                .join("\t") + "\n"
            );
          return wordText(value) + (key === "w:p" ? "\n" : "");
        })
        .join(""),
    )
    .join("");
}
export async function extractOfficeText(
  bytes: Buffer,
  kind: "docx" | "xlsx",
): Promise<string> {
  const files = await xmlEntries(bytes);
  let output = "";
  if (kind === "docx") {
    const xml = files.get("word/document.xml");
    if (!xml) throw new Error("Файл не является документом DOCX.");
    const parser = new XMLParser({
      preserveOrder: true,
      parseTagValue: false,
      ignoreAttributes: true,
      processEntities: false,
    });
    output = wordText(parser.parse(xml));
  } else {
    if (!files.has("xl/workbook.xml"))
      throw new Error("Файл не является книгой XLSX.");
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      removeNSPrefix: true,
      processEntities: false,
    });
    const shared = files.get("xl/sharedStrings.xml");
    const strings = shared
      ? array(record(record(parser.parse(shared)).sst).si).map(richText)
      : [];
    const sheets = [...files].filter(([path]) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(path),
    );
    if (sheets.length > 5)
      throw new Error("В Excel поддерживается до 5 листов.");
    let rows = 0;
    for (const [path, xml] of sheets) {
      const data = record(record(parser.parse(xml)).worksheet);
      output += `\nЛист ${path.match(/sheet(\d+)/)?.[1]}\n`;
      for (const row of array(record(data.sheetData).row)) {
        if (++rows > 1000)
          throw new Error("В Excel поддерживается до 1000 строк.");
        const values = array(record(row).c).map((cell) => {
          const c = record(cell);
          if (c.f !== undefined)
            throw new Error(
              "В списке есть формулы. Сохраните значения без формул или экспортируйте CSV.",
            );
          const type = c["@_t"];
          return type === "s"
            ? (strings[Number(c.v)] ?? "")
            : type === "inlineStr"
              ? richText(c.is)
              : scalar(c.v);
        });
        output += values.join("\t") + "\n";
      }
    }
  }
  output = output.trim();
  if (!output)
    throw new Error(
      "В документе нет читаемого текста. Для скана используйте PDF или фото.",
    );
  if (output.length > 16000)
    throw new Error(
      "Список слишком длинный: до 16 000 символов. Разделите документ на части.",
    );
  return output;
}

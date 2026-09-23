import type { ProductDetail } from "../catalog/types";
import type { Comparison, Conflict } from "./types";

function valueNumber(value: string | undefined): number | null {
  const match = value?.match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
}
function matchNumber(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  return match ? Number(match[1].replace(",", ".")) : null;
}
export function family(name: string): string | null {
  if (/диф|авдт/i.test(name)) return "rcbo";
  if (/узо/i.test(name)) return "rcd";
  if (/(?:^|\s)(?:ав|ва|ba)(?:\s|$)|автоматическ.*выключател/i.test(name))
    return "breaker";
  if (/клемм/i.test(name)) return "terminal";
  if (/коробк/i.test(name)) return "box";
  if (/реле/i.test(name)) return "relay";
  if (/светильник|ламп|led|il mx/i.test(name)) return "light";
  return null;
}
export function extractSpecs(product: ProductDetail) {
  const p = product.properties;
  const titleCurrent = matchNumber(
    product.name,
    /(\d+(?:[.,]\d+)?)\s*[аa](?![a-zа-я])/i,
  );
  const propertyCurrent = valueNumber(p.NOMINALNYY_TOK);
  const polesMatch = product.name.match(/(\d)\s*[фpр](?:\s*\+\s*([nн]))?/i);
  const poles = polesMatch
    ? polesMatch[1] + (polesMatch[2] ? "+N" : "")
    : p.KOLICHESTVO_POLYUSOV || null;
  return {
    family: family(product.name),
    current: titleCurrent ?? propertyCurrent,
    titleCurrent,
    propertyCurrent,
    poles,
    breaking:
      valueNumber(p.NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST) ??
      matchNumber(product.name, /(\d+(?:[.,]\d+)?)\s*[kк][аa]/i),
    voltage: valueNumber(p.NOMINALNOE_NAPRYAZHENIE),
    leakage: matchNumber(product.name, /(\d+(?:[.,]\d+)?)\s*[мm][аa]/i),
    curve:
      p.KHARAKTERISTIKA_SRABATYVANIYA ||
      product.name
        .match(/х(?:ар)?[- ]?ка\s*([BCDВСД])/i)?.[1]
        ?.replace("В", "B")
        .replace("С", "C")
        .replace("Д", "D") ||
      null,
    wires: matchNumber(product.name, /(\d+)\s*[- ]?(?:пров|провод)/i),
  };
}
export function detectConflicts(product: ProductDetail): Conflict[] {
  const specs = extractSpecs(product);
  const result: Conflict[] = [];
  if (
    specs.titleCurrent !== null &&
    specs.propertyCurrent !== null &&
    specs.titleCurrent !== specs.propertyCurrent
  ) {
    result.push({
      field: "Номинальный ток",
      nameValue: `${specs.titleCurrent} А в названии`,
      propertyValue: `${specs.propertyCurrent} А в характеристиках`,
    });
  }
  const descriptionCurrent = matchNumber(
    product.description,
    /номинальный\s+ток\s*[:–-]?\s*(\d+(?:[.,]\d+)?)\s*[аa](?![a-zа-я])/i,
  );
  if (
    !result.length &&
    descriptionCurrent !== null &&
    specs.propertyCurrent !== null &&
    descriptionCurrent !== specs.propertyCurrent
  ) {
    result.push({
      field: "Номинальный ток",
      nameValue: `${descriptionCurrent} А в описании`,
      propertyValue: `${specs.propertyCurrent} А в характеристиках`,
    });
  }
  return result;
}
// Conservative candidate comparison, never a certificate of interchangeability.
export function compareProducts(
  original: ProductDetail,
  candidate: ProductDetail,
): Comparison | null {
  const a = extractSpecs(original),
    b = extractSpecs(candidate);
  if (!a.family || a.family !== b.family || original.id === candidate.id)
    return null;
  if (!["breaker", "rcbo", "rcd", "terminal"].includes(a.family)) return null;
  const comparison: Comparison = {
    originalId: original.id,
    originalName: original.name,
    matches: [],
    differences: [],
    unknowns: [],
    blocked: false,
  };
  const critical: [string, string | number | null, string | number | null][] =
    [];
  if (["breaker", "rcbo", "rcd"].includes(a.family)) {
    critical.push(
      ["Номинальный ток, А", a.current, b.current],
      ["Полюса по маркировке", a.poles, b.poles],
    );
    if (a.family !== "breaker")
      critical.push(["Ток утечки, мА", a.leakage, b.leakage]);
  } else if (a.family === "terminal")
    critical.push(
      ["Число проводников", a.wires, b.wires],
      ["Ток, А", a.current, b.current],
    );
  // Reject known critical mismatches. Missing fields remain explicit review items.
  for (const [label, left, right] of critical) {
    if (left !== null && right !== null && left !== right) return null;
    if (left === null || right === null) comparison.unknowns.push(label);
    else comparison.matches.push(`${label}: ${left}`);
  }
  for (const [label, left, right] of [
    ["Отключающая способность, кА", a.breaking, b.breaking],
    ["Напряжение, В", a.voltage, b.voltage],
    ["Характеристика срабатывания", a.curve, b.curve],
  ] as const) {
    if (!["breaker", "rcbo", "rcd"].includes(a.family)) continue;
    if (left === null || right === null) comparison.unknowns.push(label);
    else if (left === right) comparison.matches.push(`${label}: ${left}`);
    else {
      comparison.differences.push(`${label}: ${left} → ${right}`);
      if (
        label === "Характеристика срабатывания" ||
        label === "Напряжение, В" ||
        (typeof left === "number" && typeof right === "number" && right < left)
      )
        comparison.blocked = true;
    }
  }
  const knownBrand = (p: ProductDetail) =>
    p.properties.TORGOVAYA_MARKA ||
    p.name.match(
      /Schneider Electric|Legrand|DEKraft|WAGO|UNIT|IEK|OPPLE/i,
    )?.[0];
  const brandA = knownBrand(original),
    brandB = knownBrand(candidate);
  if (brandA && brandB)
    (brandA === brandB ? comparison.matches : comparison.differences).push(
      brandA === brandB ? `Бренд: ${brandA}` : `Бренд: ${brandA} → ${brandB}`,
    );
  if (detectConflicts(original).length || detectConflicts(candidate).length) {
    comparison.blocked = true;
    comparison.unknowns.push(
      "Противоречие в данных поставщика — нужно подтвердить номинал",
    );
  }
  comparison.unknowns.push(
    a.family === "rcbo" || a.family === "rcd"
      ? "Тип дифференциальной защиты и совместимость с установкой"
      : a.family === "terminal"
        ? "Сечение и материал проводников, способ соединения и монтаж"
        : "Габариты, монтаж и совместимость с установкой",
  );
  if (comparison.matches.length === 0) return null;
  return comparison;
}

export function saleStock(product: ProductDetail): number | null {
  if (!product.stocksKnown) return product.totalQuantity === 0 ? 0 : null;
  const stores = product.stores.filter((s) => !s.excluded);
  if (stores.some((s) => s.quantity === null)) return null;
  return stores.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
}

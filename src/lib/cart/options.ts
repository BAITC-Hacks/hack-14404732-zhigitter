import type { AssistantCard } from "../assistant/types";
import type { CartSelection, SupplyOption } from "./types";

export function buildSupplyOptions(
  card: AssistantCard,
  candidates: AssistantCard[],
  wanted: number,
  city: string,
): SupplyOption[] {
  const product = card.product;
  if (
    card.conflicts.length ||
    product.price === null ||
    product.price <= 0 ||
    !Number.isSafeInteger(wanted) ||
    wanted < 1 ||
    wanted > 100000
  )
    return [];
  const stockIn = (c: AssistantCard, place: string | null) =>
    c.product.stores
      .filter(
        (s) =>
          !s.excluded &&
          s.city &&
          s.quantity !== null &&
          s.quantity > 0 &&
          (!place || s.city === place),
      )
      .reduce((sum, s) => sum + Math.floor(s.quantity!), 0);
  const line = (
    c: AssistantCard,
    q: number,
    sourceCity: string | null,
    originalId: number | null = null,
  ): CartSelection => ({
    productId: c.product.id,
    quantity: q,
    sourceCity,
    originalId,
  });
  const local = stockIn(card, city),
    network = stockIn(card, null),
    options: SupplyOption[] = [];
  if (local > 0) {
    const quantity = Math.min(local, wanted);
    options.push({
      id: "local",
      label:
        quantity === wanted
          ? `Все ${wanted} из ${city}`
          : `Взять ${quantity} из ${wanted} в ${city}`,
      detail:
        quantity === wanted
          ? "Весь объём есть в выбранном городе"
          : "Остальная потребность останется несобранной",
      lines: [line(card, quantity, city)],
      covered: quantity,
      total: product.price * quantity,
      warnings: [],
    });
  }
  if (local < wanted && network >= wanted)
    options.push({
      id: "network",
      label:
        local > 0
          ? `${local} из ${city} + ${wanted - local} с других складов`
          : `Все ${wanted} с других складов`,
      detail: "Срок перемещения и стоимость доставки нужно согласовать",
      lines: [line(card, wanted, null)],
      covered: wanted,
      total: product.price * wanted,
      warnings: ["Условия доставки требуют согласования"],
    });
  const otherCities = [
    ...new Set(
      product.stores
        .filter((s) => s.city && s.city !== city && !s.excluded)
        .map((s) => s.city!),
    ),
  ];
  const remote = otherCities.find((place) => stockIn(card, place) >= wanted);
  if (remote)
    options.push({
      id: "remote",
      label: `Все ${wanted} из ${remote}`,
      detail: "Отдельный вариант отгрузки; срок не подтверждён",
      lines: [line(card, wanted, remote)],
      covered: wanted,
      total: product.price * wanted,
      warnings: ["Условия доставки требуют согласования"],
    });
  for (const candidate of candidates.filter(
    (c) =>
      c.comparison?.originalId === product.id &&
      !c.comparison.blocked &&
      !c.conflicts.length &&
      c.product.price !== null &&
      c.product.price > 0,
  )) {
    const candidateLocal = stockIn(candidate, city),
      missing = Math.max(0, wanted - local);
    if (local > 0 && missing > 0 && candidateLocal >= missing)
      options.push({
        id: `split-${candidate.product.id}`,
        label: `${local} исходных + ${missing} заменой`,
        detail: `${candidate.product.article} · совместимость требует проверки`,
        lines: [
          line(card, local, city),
          line(candidate, missing, city, product.id),
        ],
        covered: wanted,
        total: local * product.price + missing * candidate.product.price!,
        warnings: ["Проверьте совместимость замены"],
      });
    else if (candidateLocal >= wanted)
      options.push({
        id: `alternative-${candidate.product.id}`,
        label: `Все ${wanted} заменой в ${city}`,
        detail: `${candidate.product.article} · ${candidate.product.name}`,
        lines: [line(candidate, wanted, city, product.id)],
        covered: wanted,
        total: wanted * candidate.product.price!,
        warnings: ["Проверьте совместимость замены"],
      });
  }
  // Prefer complete solutions while retaining a clearly labelled partial option.
  return options
    .sort((a, b) => Number(b.covered === wanted) - Number(a.covered === wanted))
    .slice(0, 5);
}

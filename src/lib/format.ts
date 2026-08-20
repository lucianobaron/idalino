// Formatação de valores em centavos para reais (BRL)

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

const grams = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Peso em gramas para exibição (ex.: 1200 → "1,2 kg"; 950 → "950 g"). */
export function formatGrams(weightGrams: number): string {
  if (weightGrams >= 1000) {
    return `${grams.format(weightGrams / 1000)} kg`;
  }
  return `${grams.format(weightGrams)} g`;
}

const km = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

/** Distância em km para exibição (ex.: 3 → "3 km"; 3.45 → "3,5 km"). */
export function formatKm(value: number): string {
  return `${km.format(value)} km`;
}

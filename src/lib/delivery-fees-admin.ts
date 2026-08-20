import { z } from "zod";

// Validação das faixas de entrega e do ponto de saída da loja no painel admin
// (DEC-16: toda entrada é validada no servidor; DEC-01: dinheiro em centavos).

export const deliveryFeeRangeInputSchema = z.object({
  minKm: z
    .number()
    .min(0, "Distância mínima inválida.")
    .max(1000, "Distância muito grande."),
  maxKm: z
    .number()
    .min(0, "Distância máxima inválida.")
    .max(1000, "Distância muito grande.")
    .nullable(),
  priceCents: z
    .number()
    .int("Preço inválido.")
    .min(0, "Preço não pode ser negativo.")
    .max(100_000_000, "Preço muito alto."),
});

export type DeliveryFeeRangeInput = z.infer<typeof deliveryFeeRangeInputSchema>;

/**
 * Valida o conjunto de faixas como um todo: sem sobreposição e com no máximo
 * UMA faixa aberta (maxKm null), que deve ser a última (maior minKm).
 * Retorna a mensagem de erro em pt-BR, ou null se o conjunto for válido.
 */
export function validateFeeRanges(
  ranges: { minKm: number; maxKm: number | null }[],
): string | null {
  for (const range of ranges) {
    if (range.maxKm !== null && range.maxKm <= range.minKm) {
      return "O limite máximo deve ser maior que o mínimo.";
    }
  }

  const sorted = [...ranges].sort((a, b) => a.minKm - b.minKm);
  const open = sorted.filter((r) => r.maxKm === null);

  if (open.length > 1) {
    return "Só pode haver uma faixa aberta (sem limite máximo).";
  }
  if (open.length === 1 && open[0] !== sorted[sorted.length - 1]) {
    return "A faixa aberta (sem limite máximo) deve ser a última.";
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.maxKm === null) continue; // aberta é a última, nada vem depois
    if (next.minKm < current.maxKm) {
      return "As faixas não podem se sobrepor.";
    }
  }
  return null;
}

export const storeSettingsInputSchema = z.object({
  cep: z
    .string()
    .trim()
    .min(8, "Informe o CEP da loja (8 dígitos).")
    .max(10, "CEP inválido."),
  street: z
    .string()
    .trim()
    .max(120, "Rua muito longa.")
    .optional()
    .or(z.literal("")),
  number: z
    .string()
    .trim()
    .max(20, "Número muito longo.")
    .optional()
    .or(z.literal("")),
  neighborhood: z
    .string()
    .trim()
    .max(80, "Bairro muito longo.")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .max(80, "Cidade muito longa.")
    .optional()
    .or(z.literal("")),
  state: z
    .string()
    .trim()
    .length(2, "UF inválida.")
    .optional()
    .or(z.literal("")),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsInputSchema>;

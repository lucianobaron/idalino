// Motor de distância da entrega
//
// Calcula a distância entre o ponto de saída da loja (StoreSettings) e o CEP do
// cliente, e encaixa a distância numa faixa de preço (DeliveryFeeRange).
// As coordenadas vêm de serviços gratuitos sem chave (AwesomeAPI CEP, com
// fallback Nominatim/OSM); o cálculo é distância em linha reta (haversine).
// A camada é isolada aqui para trocar o provedor de coordenadas/distância
// (ex.: Google Maps em produção) sem tocar no resto do sistema.

import { prisma } from "@/lib/prisma";
import type { DeliveryFeeRange } from "@prisma/client";

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Normaliza CEP: remove não-dígitos; retorna null se não tiver 8 dígitos. */
export function normalizeCep(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** Distância em linha reta (haversine) entre duas coordenadas, em km. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

/** Coordenadas do ponto de saída da loja; null se ainda não configurado no painel. */
export async function getStoreOrigin(): Promise<Coordinates | null> {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
  });
  return settings ? { lat: settings.lat, lng: settings.lng } : null;
}

/**
 * Encontra a faixa que cobre a distância (minKm <= d < maxKm; faixa aberta com
 * maxKm null cobre d >= minKm). Assume faixas sem sobreposição (validadas no
 * admin). Retorna null quando a distância está fora de toda faixa.
 */
export function findDeliveryFee(
  distanceKm: number,
  ranges: DeliveryFeeRange[],
): DeliveryFeeRange | null {
  const sorted = [...ranges].sort((a, b) => a.minKm - b.minKm);
  for (const range of sorted) {
    if (distanceKm < range.minKm) return null;
    if (range.maxKm === null || distanceKm < range.maxKm) return range;
  }
  return null;
}

const cepCache = new Map<string, Coordinates | null>();

/**
 * Resolve um CEP para coordenadas, com cache em memória.
 * Primário: AwesomeAPI CEP (grátis, sem chave, devolve lat/lng).
 * Fallback: Nominatim/OpenStreetMap via busca por postalcode (precisa; o texto
 * livre "CEP X Brasil" devolve correspondências fuzzy incorretas — evitado).
 */
export async function resolveCepCoordinates(
  cep: string,
): Promise<Coordinates | null> {
  if (cepCache.has(cep)) return cepCache.get(cep) ?? null;

  let coords: Coordinates | null = null;

  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        lat?: string | number;
        lng?: string | number;
      };
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        (lat !== 0 || lng !== 0)
      ) {
        coords = { lat, lng };
      }
    }
  } catch {
    // tenta o fallback abaixo
  }

  if (!coords) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(cep)}&country=Brasil`,
        {
          headers: { "User-Agent": "IdalinoTortas/0.1 (contato: site da loja)" },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { lat?: string; lon?: string }[];
        const first = data[0];
        if (first) {
          const lat = Number(first.lat);
          const lng = Number(first.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            coords = { lat, lng };
          }
        }
      }
    } catch {
      // sem coordenadas — retorna null
    }
  }

  cepCache.set(cep, coords);
  return coords;
}

export type DeliveryQuote =
  | { ok: true; distanceKm: number; feeCents: number }
  | {
      ok: false;
      reason: "cep-invalido" | "origem-nao-configurada" | "fora-da-cobertura";
    };

/**
 * Calcula a cotação de entrega para um CEP: resolve coordenadas, mede a
 * distância até a loja e encontra a faixa de preço.
 */
export async function quoteDelivery(cepRaw: string): Promise<DeliveryQuote> {
  const cep = normalizeCep(cepRaw);
  if (!cep) return { ok: false, reason: "cep-invalido" };

  const origin = await getStoreOrigin();
  if (!origin) return { ok: false, reason: "origem-nao-configurada" };

  const coords = await resolveCepCoordinates(cep);
  if (!coords) return { ok: false, reason: "cep-invalido" };

  const distanceKm = haversineKm(origin, coords);

  const ranges = await prisma.deliveryFeeRange.findMany();
  const range = findDeliveryFee(distanceKm, ranges);
  if (!range) return { ok: false, reason: "fora-da-cobertura" };

  return { ok: true, distanceKm, feeCents: range.priceCents };
}

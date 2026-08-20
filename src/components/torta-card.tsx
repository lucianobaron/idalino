"use client";

import Link from "next/link";
import { useCart } from "./cart/cart-context";
import { formatBRL } from "@/lib/format";

interface TortaCardProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
}

/** Card de produto na vitrine (F6 product card — um sinal por elemento) */
export function TortaCard({
  id,
  slug,
  name,
  description,
  priceCents,
  emoji,
}: TortaCardProps) {
  const { addItem } = useCart();

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-rule bg-paper-2 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-whisper">
      <Link
        href={`/tortas/${slug}`}
        className="flex h-44 items-center justify-center bg-paper-3 text-7xl"
        aria-label={name}
      >
        <span aria-hidden>{emoji}</span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/tortas/${slug}`}>
          <h3 className="text-lg font-semibold text-ink transition hover:text-accent">
            {name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm text-muted">{description}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold tabular-nums text-ink">
            {formatBRL(priceCents)}
          </span>
          <button
            type="button"
            onClick={() =>
              addItem({
                productId: id,
                slug,
                name,
                emoji,
                priceCents,
                quantity: 1,
              })
            }
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

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

/** Card de produto na vitrine */
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
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
      <Link
        href={`/tortas/${slug}`}
        className="flex h-44 items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50 text-7xl transition group-hover:scale-[1.02]"
        aria-label={name}
      >
        <span aria-hidden>{emoji}</span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/tortas/${slug}`}>
          <h3 className="text-lg font-semibold text-zinc-900 hover:text-rose-700">
            {name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm text-zinc-500">{description}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold text-zinc-900">
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
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-95"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

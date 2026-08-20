"use client";

import { TortaImage } from "@/components/torta-image";
import Link from "next/link";
import { CartControls } from "./cart/cart-controls";
import { formatBRL } from "@/lib/format";

interface TortaCardProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
  /** Foto ilustrativa; quando ausente, cai para o emoji (convenção §3.7) */
  imageUrl?: string;
}

/** Card de produto na vitrine (F6 product card — um sinal por elemento) */
export function TortaCard({
  id,
  slug,
  name,
  description,
  priceCents,
  emoji,
  imageUrl,
}: TortaCardProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-rule bg-paper-2 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-whisper">
      <Link
        href={`/tortas/${slug}`}
        className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-paper-3"
        aria-label={name}
      >
        <TortaImage
          src={imageUrl ?? null}
          alt={name}
          emoji={emoji}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-200 ease-out group-hover:scale-105"
          emojiClassName="text-7xl"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/tortas/${slug}`}>
          <h3 className="text-lg font-semibold text-ink transition hover:text-accent">
            {name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm text-muted">{description}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-lg font-bold tabular-nums text-ink">
            {formatBRL(priceCents)}
          </span>
          <CartControls
            productId={id}
            slug={slug}
            name={name}
            emoji={emoji}
            priceCents={priceCents}
            imageUrl={imageUrl}
            variant="card"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

type TortaImageProps = {
  src: string | null;
  alt: string;
  emoji: string;
  sizes: string;
  className?: string;
  emojiClassName?: string;
  unoptimized?: boolean;
};

/**
 * Imagem da torta com fallback para o emoji: sem foto, ou quando a imagem
 * falha ao carregar (URL errada, host bloqueado, 404), exibe o emoji (convenção §3.7).
 */
export function TortaImage({
  src,
  alt,
  emoji,
  sizes,
  className,
  emojiClassName = "text-4xl",
  unoptimized = false,
}: TortaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center ${emojiClassName}`}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={unoptimized}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

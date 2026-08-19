import Image from "next/image";
import { APP_NAME, APP_LOGO_PATH } from "@/lib/constants";

type LogoProps = {
  /** Tamanho (px) do quadrado do logo. Padrão: 40. */
  size?: number;
  /** Exibir o nome da empresa ao lado do logo. Padrão: true. */
  showName?: boolean;
  /** Usar cores para fundo escuro (texto branco). */
  inverted?: boolean;
  /** Classes adicionais para o contêiner. */
  className?: string;
};

/**
 * Logo oficial do projeto: imagem (logoidalino.jpg) + nome da empresa.
 * Usado no cabeçalho, rodapé e demais views.
 */
export function Logo({
  size = 40,
  showName = true,
  inverted = false,
  className = "",
}: LogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={APP_NAME}
    >
      <Image
        src={APP_LOGO_PATH}
        alt={`Logo ${APP_NAME}`}
        width={size}
        height={size}
        className="h-auto w-auto shrink-0 object-contain"
        priority
      />
      {showName && (
        <span
          className={`text-xl font-bold tracking-tight ${
            inverted ? "text-white" : "text-zinc-900"
          }`}
        >
          {APP_NAME}
        </span>
      )}
    </span>
  );
}

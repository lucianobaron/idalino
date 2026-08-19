import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/cart/cart-context";
import { CartButton } from "@/components/cart/cart-button";
import { Logo } from "@/components/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s — ${APP_NAME}`,
  },
  description:
    "Encomende tortas artesanais diretamente da nossa fábrica. Pagamento digital e entrega com carinho.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 font-sans text-zinc-900">
        <CartProvider>
          <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2">
                <Logo size={36} />
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/#tortas"
                  className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:block"
                >
                  Tortas
                </Link>
                <Link
                  href="/#como-funciona"
                  className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:block"
                >
                  Como funciona
                </Link>
                <CartButton />
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-zinc-500">
              <Logo size={40} />
              <p className="font-medium text-zinc-700">{APP_TAGLINE}</p>
              <p>Encomendas pelo site • Pagamento digital • Produção artesanal</p>
              <p className="text-xs text-zinc-400">
                © {new Date().getFullYear()} {APP_NAME}. Todos os direitos
                reservados.
              </p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}

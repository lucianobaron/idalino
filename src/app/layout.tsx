import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/cart/cart-context";
import { CartButton } from "@/components/cart/cart-button";
import { Logo } from "@/components/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        <CartProvider>
          {/* Nav N1a — soft, integrada ao papel: sem sticky, sem hairline */}
          <header className="bg-paper">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2">
                <Logo size={36} />
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/#tortas"
                  className="hidden text-sm font-medium text-muted transition hover:text-ink sm:block"
                >
                  Tortas
                </Link>
                <Link
                  href="/#como-funciona"
                  className="hidden text-sm font-medium text-muted transition hover:text-ink sm:block"
                >
                  Como funciona
                </Link>
                <CartButton />
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          {/* Footer Ft5 — statement de fechamento */}
          <footer className="border-t border-rule bg-paper-2">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <Logo size={44} />
              <p className="mt-6 max-w-md font-display text-2xl font-medium leading-snug text-ink sm:text-3xl">
                Feito à mão, todos os dias.
              </p>
              <p className="mt-4 text-sm text-muted">
                Encomendas pelo site · Pagamento digital · Produção artesanal
              </p>
              <p className="mt-8 text-xs text-faint">
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

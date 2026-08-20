"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

type SessionInfo = { name: string; role: "ADMIN" | "TEAM" } | null;

const allLinks = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/tortas", label: "Tortas", adminOnly: true },
  { href: "/admin/entregas", label: "Entregas", adminOnly: true },
  { href: "/admin/usuarios", label: "Usuários", adminOnly: true },
];

/** Cabeçalho interno do painel admin com navegação, usuário logado e sair */
export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [session, setSession] = useState<SessionInfo>(null);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        setSession(
          data?.name && data?.role
            ? { name: data.name, role: data.role }
            : null,
        ),
      )
      .catch(() => setSession(null));
  }, []);

  const links = allLinks.filter(
    (link) => !link.adminOnly || session?.role === "ADMIN",
  );

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-rule bg-paper-2">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-sm font-medium text-faint">· Admin</span>
          </Link>
          <nav className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition ${
                  pathname === link.href ||
                  pathname.startsWith(`${link.href}/`)
                    ? "text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {session?.name && (
            <span className="hidden max-w-[160px] truncate text-sm text-faint sm:block">
              {session.name}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm font-medium text-muted transition hover:text-accent disabled:opacity-50"
          >
            {loggingOut ? "Saindo…" : "Sair"}
          </button>
        </div>
      </div>
    </header>
  );
}

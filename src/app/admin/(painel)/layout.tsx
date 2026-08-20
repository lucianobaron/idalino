import { requireAdmin } from "@/lib/admin-guard";

/**
 * Portão central do painel admin (route group `(painel)`).
 *
 * Todo caminho sob /admin — exceto /admin/login, que vive fora deste grupo —
 * passa por esta guarda: sem sessão válida, redireciona para o login.
 * As páginas mantêm suas guardas específicas (papel) como defesa em
 * profundidade; este layout garante a exigência de login mesmo para uma
 * página nova que esqueça a própria guarda.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}

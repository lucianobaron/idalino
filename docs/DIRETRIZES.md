# Diretrizes do Projeto — Idalino

> **Escopo deste documento:** registrar **todas as decisões de projeto** já tomadas
> (com contexto, consequência e onde vivem no código) e os **procedimentos que
> devem ser observados** por qualquer pessoa — humana ou agente — que trabalhe
> neste repositório.
>
> Documentos irmãos: [`REGRAS-DE-NEGOCIO.md`](REGRAS-DE-NEGOCIO.md) (o que o
> sistema faz, em termos de negócio) e [`TECNICO.md`](TECNICO.md) (stack,
> arquitetura, achados e intercorrências).

## 1. Propósito e como usar

- Este arquivo é a fonte da verdade para **decisões** e **procedimentos**.
- Antes de implementar algo, leia a seção 2: se a decisão já existe, siga-a em vez de
  redecidir. Se uma decisão existente for alterada, **não apague o histórico**: marque
  a entrada antiga como `substituída` e aponte para a nova.
- Toda nova decisão relevante entra na seção 2 com um ID (`DEC-x`) e a data.
- Todo procedimento que mudar é atualizado na seção 3 — e, quando afetar regras de
  negócio ou o código, as docs irmãs também.

## 2. Decisões do projeto

Legenda de status: `aceita` (vigente) · `substituída` (vale o histórico, não mais a prática).

### DEC-01 — Dinheiro sempre em centavos inteiros
- **Status:** aceita · **Data:** projeto inicial (commit `0397305`)
- **Contexto:** valores monetários em ponto flutuante causam erros de arredondamento.
- **Decisão:** todo valor monetário é armazenado e trafegado como inteiro em centavos.
  Convenção de nomes: sufixo `Cents` (`priceCents`, `subtotalCents`, `deliveryFeeCents`,
  `totalCents`, `unitPriceCents`, `amountCents`). A conversão para
  exibição acontece apenas na borda, via `formatBRL()` (`src/lib/format.ts`).
- **Onde:** `prisma/schema.prisma`, `src/lib/format.ts`, `src/lib/constants.ts`,
  `src/lib/payments/types.ts`.
- **Consequência:** nunca use `float`/`number` fracionário para dinheiro; nunca formate
  dinheiro manualmente — use `formatBRL()`.

### DEC-02 — Camada de pagamento isolada atrás de uma interface
- **Status:** aceita
- **Contexto:** o projeto começa com pagamento simulado, mas deve permitir plugar um
  gateway real (Mercado Pago, Stripe, Pagar.me...) sem tocar no resto do sistema.
- **Decisão:** todo o sistema depende **apenas** da interface `PaymentProvider`
  (`src/lib/payments/types.ts`). O provedor atual é `MockPaymentProvider`
  (`src/lib/payments/mock.ts`), selecionado pela variável `PAYMENT_PROVIDER` na factory
  (`src/lib/payments/index.ts`). A confirmação real de um gateway chegaria por webhook;
  o mock expõe `approve()` para simular esse webhook manualmente.
- **Consequência:** integrar gateway = implementar `PaymentProvider`, registrar na
  factory e apontar `PAYMENT_PROVIDER` no `.env`. Nenhuma outra parte do código muda
  (procedimento completo em `TECNICO.md` §8).

### DEC-03 — Autenticação do admin: senha única + cookie HMAC (nível dev)
- **Status:** substituída (ver DEC-22) · **Data:** projeto inicial (commit `0397305`)
- **Contexto:** painel administrativo precisa de controle de acesso simples na fase de
  desenvolvimento.
- **Decisão:** senha única (`ADMIN_PASSWORD`, default dev `idalino-admin`) que emite um
  cookie assinado `idalino_admin` (HMAC-SHA256 sobre `exp=...`, validade de 3 dias,
  `httpOnly`, `sameSite: lax`, `secure` controlado por `COOKIE_SECURE`).
  Implementação em `src/lib/auth.ts`; rota de login em `src/app/api/admin/login/route.ts`.
- **Consequência / restrição:** é **insuficiente para produção** (sem rate-limit, senha
  única sem hash, sem MFA). Em produção: trocar por Auth.js/NextAuth ou SSO, definir
  `ADMIN_SECRET` forte e `COOKIE_SECURE=true`, e remover o hint de senha padrão do
  formulário de login. Ver `TECNICO.md` §6 (segurança) e achados.
- **Substituída por:** DEC-22 (usuários admin com senha por usuário).

### DEC-04 — PostgreSQL via Docker + Prisma ORM
- **Status:** aceita
- **Contexto:** banco relacional com migrations versionadas e ergonomia de tipos.
- **Decisão:** PostgreSQL 16 (`postgres:16-alpine`) em `docker-compose.yml`
  (container `idalino-db`, porta 5432, volume `idalino_pgdata`), acessado via Prisma
  (`prisma/schema.prisma`). Migrations com `prisma migrate dev`; seed idempotente
  (`prisma/seed.mjs`, upsert por slug). Cliente Prisma é singleton em
  `src/lib/prisma.ts` (evita múltiplas conexões no hot reload).
- **Consequência:** qualquer mudança de modelo exige migration; o banco local é
  efêmero (volume Docker) e pode ser recriado com `npm run db:reset`.

### DEC-05 — Next.js App Router, componentes servidor por padrão
- **Status:** aceita
- **Contexto:** páginas de vitrine, pedido e admin leem o banco.
- **Decisão:** páginas que consultam o banco são Server Components com
  `export const dynamic = "force-dynamic"` (sem cache de build; consulta a cada acesso).
  Apenas superfícies interativas são client components (`"use client"`): carrinho,
  checkout, controles de status, botões.
- **Consequência:** dados do banco nunca são "congelados" em build; para escala alta,
  revisar cacheamento (ver achados em `TECNICO.md` §7).

### DEC-06 — Nunca confiar no preço enviado pelo cliente
- **Status:** aceita
- **Contexto:** carrinho é client-side (localStorage) e o cliente poderia adulterar
  preços/quantidades.
- **Decisão:** a API `POST /api/orders` revalida tudo no servidor: busca os produtos
  (somente `available: true`), recalcula `subtotalCents` a partir do preço **do banco**
  e aplica a taxa de entrega. Preço do carrinho é apenas exibição.
- **Onde:** `src/app/api/orders/route.ts`.
- **Consequência:** nunca calculamos total a partir de valores vindos do cliente;
  qualquer item indisponível anula o pedido (`400`).

### DEC-07 — Transições de status centralizadas e auditadas
- **Status:** aceita
- **Contexto:** o fluxo de produção precisa de uma única fonte de verdade para
  transições válidas e de trilha de auditoria.
- **Decisão:** o mapa de transições vive em `src/lib/order-status.ts`
  (`ORDER_STATUS_TRANSITIONS` + `canTransition()`), único lugar que define o que é
  válido. Toda mudança de status grava um `ProductionEvent` (de/para/nota/data).
- **Consequência:** nenhuma rota decide transição "na mão"; UI e API consomem o mesmo
  mapa. Qualquer alteração de fluxo de produção é feita **só** nesse arquivo (+ regras
  em `REGRAS-DE-NEGOCIO.md`).

### DEC-08 — Pedidos imutáveis nos itens (snapshot)
- **Status:** aceita
- **Contexto:** se o produto mudar de nome/preço depois, pedidos antigos não podem ser
  afetados.
- **Decisão:** `OrderItem` copia `productName` e `unitPriceCents` no momento do pedido
  (o link `productId` é opcional e não usado para exibição de valores).
- **Onde:** `prisma/schema.prisma` (modelo `OrderItem`).

### DEC-09 — Cliente identificado por e-mail (upsert)
- **Status:** aceita
- **Contexto:** encomendas repetidas do mesmo cliente.
- **Decisão:** `Customer` tem `email` único; ao criar pedido, faz-se upsert por e-mail
  (nome atualizado para o último informado).
- **Consequência:** um mesmo e-mail = um único cliente com N pedidos; o telefone não é
  atualizado no upsert (fica o primeiro informado — comportamento atual, ver
  `REGRAS-DE-NEGOCIO.md` BR-008).

### DEC-10 — Identidade visual e nomes centralizados em constantes
- **Status:** aceita
- **Contexto:** marca "Idalino Tortas" com tagline e logo.
- **Decisão:** `APP_NAME`, `APP_TAGLINE` e `APP_LOGO_PATH` vivem em
  `src/lib/constants.ts`; logo como componente `src/components/logo.tsx` com arte em
  `public/logoidalino.jpg`. Idioma do site: pt-BR (`<html lang="pt-BR">`), fonte Geist.
- **Consequência:** rebranding = alterar constantes + logo, sem tocar páginas.

### DEC-11 — `fable-method` incorporado (vendored) como diretriz de agentes
- **Status:** aceita
- **Contexto:** agentes que trabalham no projeto devem seguir um método de raciocínio
  com verificação por observação.
- **Decisão:** a pasta `fable-method/` é cópia (vendored) do repositório
  [Sahir619/fable-method](https://github.com/Sahir619/fable-method) (branch `main`,
  licença MIT). Agentes devem seguir `fable-method/AGENTS.md`.
- **Consequência:** atualizar baixando o tarball da branch `main` e substituindo a
  pasta, **mantendo** este README e a licença; não editar o conteúdo vendored.

### DEC-12 — Instalação com `ignore-scripts` (npmrc)
- **Status:** aceita
- **Contexto:** ambientes restritos (sandbox) bloqueiam scripts de post-install.
- **Decisão:** `.npmrc` define `ignore-scripts=true`; todos os pacotes entregam binários
  prontos e o cliente Prisma é gerado manualmente com `npx prisma generate`.
- **Consequência:** `npm install` não roda scripts; lembrar do `prisma generate` no
  setup (procedimento §3.1).

### DEC-13 — Carrinho persistido no localStorage
- **Status:** aceita
- **Contexto:** carrinho simples, sem conta de usuário.
- **Decisão:** estado do carrinho em React Context (`src/components/cart/cart-context.tsx`),
  persistido em `localStorage` (chave `idalino-cart`), hidratado só no cliente.
  Quantidade `<= 0` remove o item; itens repetidos somam quantidade.
- **Consequência:** carrinho é por navegador; o servidor revalida tudo na finalização
  (DEC-06).

### DEC-14 — Formato de código amigável do pedido
- **Status:** aceita
- **Contexto:** cliente precisa de um número curto para acompanhar.
- **Decisão:** `Order.code` é inteiro `autoincrement()` único, exibido zero-padded
  (`#001`). O `paymentId` do provedor fica em campo separado, nunca exposto como
  número do pedido.
- **Consequência:** após `db:reset` a contagem reinicia; não é um número contábil.

### DEC-15 — Skill fable-method como ferramenta complementar no processamento de solicitações
- **Status:** aceita
- **Contexto:** o projeto já incorpora o fable-method (DEC-11); esta decisão formaliza
  o **uso ativo** da skill como processo padrão de trabalho.
- **Decisão:** toda solicitação de desenvolvimento, evolução ou análise neste projeto
  deve ser processada usando a **skill fable-method como ferramenta complementar** de
  raciocínio: classificar o pedido (pergunta/tarefa/plano-primeiro) → definir "done"
  com verificação nomeada → reunir evidências em fontes primárias (código, docs,
  outputs reais) → decidir e recomendar uma opção → agir cirurgicamente → verificar
  **por observação** → reportar resultado primeiro, com ressalvas honestas. A skill é
  complementar: não substitui o bom senso, as demais diretrizes deste arquivo nem a
  supervisão humana; é o processo padrão pelo qual o trabalho é executado.
- **Onde:** `fable-method/skills/fable-method/SKILL.md` (regras do loop),
  `fable-method/AGENTS.md` (versão portátil para qualquer agente/harness).
- **Consequência:** entregas seguem o loop; relatórios são outcome-first; verificações
  são observáveis (rodar, não inferir); os gates da skill (autorização para ações
  externas, recall de APIs/valores, artefatos obrigatórios `INTENT`/`AUTH`/`PENDING`/
  `TWINS`) aplicam-se ao trabalho neste repositório. Procedimento operacional: §3.9.

### DEC-16 — Desenvolvimento limpo e segurança de software sempre prioritários
- **Status:** aceita
- **Contexto:** diretriz transversal que vale para qualquer mudança, de qualquer porte.
- **Decisão:** **sempre priorizar as melhores práticas de desenvolvimento limpo e de
  segurança do software.** Nenhuma entrega pode violar, mesmo sob pressão de prazo:
  - *Clean code*: nomes significativos e consistentes (pt-BR no domínio, sufixos
    `Cents` para dinheiro), funções/componentes pequenos com uma responsabilidade,
    simplicidade sobre engenharia excessiva, comentários que expliquem o *porquê*
    (não o *quê*), zero código morto/duplicado deliberado, formatação consistente
    (ESLint/Prettier onde houver).
  - *Segurança*: segredos nunca no código nem no git (sempre em variáveis de
    ambiente), validação de toda entrada no servidor (Zod), nunca confiar no cliente
    (preços, status, identidade), mínimo privilégio, autenticação/cookies adequados
    ao ambiente (ver DEC-03 e §3.8), dependências atualizadas e auditadas, sem
    endpoints sensíveis sem autorização.
- **Consequência:** em conflito entre velocidade e clareza/segurança, **clareza e
  segurança vencem**. Revisões de código avaliam explicitamente esses dois critérios
  (checklist operacional: §3.10).

### DEC-17 — Skill `hallmark` incorporada (vendored) como referência de design
- **Status:** aceita
- **Contexto:** o projeto quer que agentes gerem UI que não pareça feita por IA,
  seguindo regras de design explícitas e verificáveis.
- **Decisão:** a pasta `hallmark/` é cópia (vendored) **da skill** do repositório
  [Nutlope/hallmark](https://github.com/Nutlope/hallmark) (branch `main`, licença
  MIT): apenas `SKILL.md` + `references/` + `LICENSE`. O `site/` e os exemplos do
  repositório **não** são incorporados (escopo deliberado, para não inflar o
  repositório com ~9 MB de demonstrações). Agentes que trabalham em UI devem
  carregar `hallmark/SKILL.md` quando o pedido envolver design de páginas.
- **Consequência:** atualizar rodando `node hallmark/update.mjs` (procedimento
  §3.11) ou baixando manualmente `skills/hallmark/` + `LICENSE`; não editar o
  conteúdo vendored — mudanças de regra devem ser propostas no repositório
  original.

### DEC-18 — Skill `hallmark` como ferramenta complementar em design e layout de views
- **Status:** aceita
- **Contexto:** o projeto incorpora a skill hallmark como referência de design
  (DEC-17); esta decisão formaliza o **uso ativo e obrigatório** dela quando o
  trabalho toca design/layout de views.
- **Decisão:** **toda solicitação que envolva design ou layout de view** — criar,
  alterar ou redesenhar qualquer página, tela ou componente de UI do projeto
  (vitrine, checkout, pedido, admin, componentes) — **deve ser processada com a
  skill hallmark como ferramenta complementar**, carregando `hallmark/SKILL.md`
  (e as `references/` que o caso exigir: temas, componentes, slop-test,
  anti-patterns, verbos `audit`/`redesign`/`study` quando aplicáveis). A skill é
  complementar: não substitui o bom senso, o fable-method (DEC-15) nem as demais
  diretrizes deste arquivo; quando conflitar, este arquivo manda e a instrução
  direta do usuário manda acima de tudo.
- **Onde:** `hallmark/SKILL.md` e `hallmark/references/` (regras, gates de
  slop-test e anti-padrões que o trabalho de UI deve respeitar).
- **Consequência:** entregas de UI seguem as regras da skill (estrutura variada,
  copy honesta sem métricas inventadas, tokens travados, responsividade
  320–768 px, etc.); revisões avaliam o resultado contra os critérios da skill,
  além dos checklists de DEC-16 (§3.10). Ver procedimento operacional: §3.9.

### DEC-19 — `.hallmark/log.json` mantido versionado (histórico de design)
- **Status:** aceita
- **Contexto:** a skill hallmark grava `/.hallmark/log.json` na raiz — log runtime
  de decisões de design (brief, macroestrutura, tema, vibe) — e o arquivo não
  estava coberto pelo `.gitignore` (achado ACH-12 em `TECNICO.md`).
- **Decisão:** **manter versionado** o `.hallmark/log.json` enquanto o design das
  views estiver em evolução: o arquivo é a trilha auditável do que a skill
  decidiu para cada tela, e perde-lo significaria perder histórico de design.
- **Consequência:** o arquivo entra no versionamento normalmente; quando o design
  estabilizar e o log virar ruído, reavaliar (adicionar `/.hallmark/` ao
  `.gitignore`), registrando a mudança neste arquivo.

### DEC-20 — Skill `i-have-adhd` incorporada: formato de interação com o dono do projeto
- **Status:** aceita
- **Contexto:** o dono do projeto tem TDAH — interações precisam de um formato que
  permita agir imediatamente, sem contexto perdido entre mensagens.
- **Decisão:** a skill `i-have-adhd` (vendored em `.claude/skills/i-have-adhd/`,
  com cópia em `.github/skills/i-have-adhd/` para GitHub Copilot; commit `cfba827`)
  define o **formato de interação obrigatório** entre o harness/agentes e o dono do
  projeto: (1) compreensão apresentada **antes** de processar o prompt, com parada
  obrigatória até a autorização explícita do dono; (2) após a autorização, cada
  etapa anunciada antes de executar e resumida ao concluir; (3) resumo geral ao
  final, com uma única próxima ação se restar algo. Vale em **toda** resposta, até
  o dono dizer "stop adhd mode". Procedimento operacional: §3.9 (bloco "Formato de
  interação").
- **Formato (alterado em 2026-08-20):** o fluxo passou a ser: compreensão → aguardar
  autorização → etapa a etapa (anunciar + executar + resumir o resultado de cada
  etapa) → resumo geral. A mudança está na seção local do `SKILL.md` (nas duas
  cópias) e no bloco "Formato de interação" do §3.9.
- **Onde:** `.claude/skills/i-have-adhd/SKILL.md` (+ `agents/` com perfis para
  Gemini/OpenAI) e `.github/skills/i-have-adhd/SKILL.md`.
- **Consequência:** respostas seguem a estrutura obrigatória; regras da skill
  (liderar com a próxima ação, listas ≤ 5 itens, sem preâmbulo/encerramento
  vazios, estimativas de tempo concretas) prevalecem até o "stop adhd mode".
  Quando a estrutura da skill conflitar com outra diretriz, a instrução direta do
  usuário manda acima de tudo.

### DEC-21 — Preço de entrega por faixas de distância (motor isolado)
- **Status:** aceita · **Data:** 2026-08-20
- **Contexto:** a taxa única de entrega (`DELIVERY_FEE_CENTS`) não reflete o custo
  real, que varia com a distância até o ponto de saída da loja. O dono pediu um
  CRUD de preço por faixas de distância e a escolha, no checkout, entre retirar na
  loja e receber em casa.
- **Decisão:** o preço da entrega vive em **faixas de distância** (`DeliveryFeeRange`:
  `minKm` inclusivo, `maxKm` exclusivo — **nulo = faixa aberta**, `priceCents`),
  geridas no painel em `/admin/entregas` (CRUD completo, validação sem sobreposição
  e no máximo uma faixa aberta por último). O **ponto de saída da loja** é
  configurável no mesmo painel (`StoreSettings`, linha única `id = "store"`; CEP
  obrigatório, endereço opcional p/ exibição). A **distância** é calculada no
  servidor pelas coordenadas dos CEPs (loja × entrega) via serviços gratuitos sem
  chave — AwesomeAPI CEP com fallback Nominatim/OSM — e distância em linha reta
  (haversine), com cache em memória; o motor é **isolado em `src/lib/delivery.ts`**
  (mesma filosofia da camada de pagamento, DEC-02) para trocar por um provedor
  preciso em produção. O pedido grava `deliveryType` (`DELIVERY | PICKUP`), a taxa
  cobrada (`deliveryFeeCents`) e a distância (`deliveryDistanceKm`) como snapshot;
  na retirada a taxa é zero e o endereço não é exigido. Distância fora de toda
  faixa **recusa** a entrega para aquele CEP (faixa aberta, quando existir, cobre
  o resto); a retirada segue sempre disponível. A taxa única `DELIVERY_FEE_CENTS`
  foi removida.
- **Onde:** `prisma/schema.prisma` (modelos `DeliveryFeeRange`, `StoreSettings`,
  enum `DeliveryType`, `Order.deliveryType`/`deliveryDistanceKm`/endereço opcional),
  `src/lib/delivery.ts`, `src/lib/delivery-fees-admin.ts`,
  `src/app/admin/(painel)/entregas/`, `src/app/api/delivery/quote/route.ts`,
  `src/app/api/admin/delivery-fees/`, `src/app/api/admin/delivery/settings/route.ts`.
- **Consequência:** em produção, migrar o motor de distância para provedor com SLA
  (ex.: Google Distance Matrix) tocando apenas `src/lib/delivery.ts`; calibragem
  das faixas deve considerar que a distância é em linha reta (rota real é maior).
  Regras de negócio: BR-010, BR-028 a BR-031 em `REGRAS-DE-NEGOCIO.md`; achado
  ACH-17 em `TECNICO.md`.

### DEC-22 — Admin com usuários (e-mail + senha por usuário, hash scrypt)
- **Status:** aceita · **Data:** 2026-08-20
- **Contexto:** o dono pediu um segundo usuário admin — o esquema de senha única
  (DEC-03) não comporta identidades individuais.
- **Decisão:** o acesso ao painel passa a ser por **usuário admin** (`AdminUser`:
  nome, e-mail único, `passwordHash`). A senha é armazenada apenas como hash
  **scrypt** do Node (`salt:hash`, comparação com `timingSafeEqual`) — sem
  dependência externa (DEC-16). Cada usuário tem um **papel** (`AdminRole`):
  `ADMIN` (tudo) ou `TEAM` (só visão geral e pedidos) — guardas por papel nas
  rotas de API (`checkAdminRole` → `401/403`) e páginas (`requireAdminRole` →
  redireciona); novo usuário nasce `TEAM` (menor privilégio); ninguém altera o
  próprio papel nem deixa o painel sem ao menos um `ADMIN`. A sessão continua o
  cookie HMAC `idalino_admin`, agora com o `uid` do usuário no payload
  (`exp=...&uid=...`); `isAdmin()` segue verificando a
  assinatura, e `getCurrentAdmin()` identifica o usuário logado (token antigo
  sem `uid` exige novo login). Gestão em `/admin/usuarios` (criar/editar/excluir;
  não exclui a si mesmo nem o último admin). O seed cria o admin inicial
  `admin@idalino.local` / `idalino-admin` (dev; alterável na tela; o seed nunca
  sobrescreve senha alterada). `ADMIN_PASSWORD` deixou de ser usado pelo login
  (permanece inerte no `.env`); `ADMIN_SECRET` continua sendo o segredo do cookie.
- **Política de sessão (alterada em 2026-08-20):** o cookie de sessão passou a ser
  **cookie de sessão do navegador** (sem `maxAge`/`expires`) — morre ao fechar o
  navegador, e `/admin` volta a exigir login na próxima abertura (decisão do dono:
  "sempre pedir login ao reabrir o navegador"). O payload do token mantém o teto
  de `exp` (3 dias, `SESSION_DAYS` em `src/lib/auth.ts`) apenas como limite máximo
  no servidor (ex.: cookie copiado manualmente).
- **Onde:** `prisma/schema.prisma` (modelo `AdminUser`, enum `AdminRole`),
  `src/lib/admin-users.ts`, `src/lib/auth.ts`, `src/lib/admin-guard.ts`,
  `src/app/api/admin/login/route.ts`, `src/app/api/admin/session/route.ts`,
  `src/app/api/admin/users/`, `src/app/admin/(painel)/usuarios/`, `prisma/seed.mjs`.
- **Endurecimento (2026-08-20):** a exigência de sessão ganhou um **portão
  central**: todas as páginas do painel vivem no route group
  `src/app/admin/(painel)/` (URLs inalteradas), com `(painel)/layout.tsx`
  chamando `requireAdmin()` — qualquer página sob `/admin` (exceto
  `/admin/login`, que fica fora do grupo) exige login **por construção**, mesmo
  que esqueça a própria guarda. As guardas por página (papel) permanecem como
  defesa em profundidade.
- **Consequência:** substitui a DEC-03 (marcada como `substituída`). Ainda é nível
  dev (sem rate-limit no login, sem MFA): em produção, trocar por Auth.js/SSO
  mantendo a mesma interface de sessão. Regras: BR-021/BR-032 em
  `REGRAS-DE-NEGOCIO.md`; achados ACH-18/ACH-21 em `TECNICO.md`.

### DEC-23 — Reação visível ao adicionar torta ao carrinho
- **Status:** substituída (ver DEC-24) · **Data:** 2026-08-20
- **Contexto:** o dono pediu que adicionar uma torta ao carrinho tenha reação
  visível — antes, o clique só mudava estado interno (itemCount/localStorage)
  sem feedback percebível.
- **Decisão:** toda adição ao carrinho dá feedback em dois lugares: (1) o botão
  adicionado troca o rótulo para **"✓ Adicionado"** (fundo `bg-accent-deep`) por
  ~1,6 s e anuncia a ação via `role="status"` (sr-only); (2) a badge do carrinho
  na navegação dá um **bump** one-shot (escala 1 → 1.35 → 1, 320 ms,
  `--ease-out`) sempre que o `itemCount` muda — a hidratação inicial do
  `localStorage` não anima (não é ação do usuário). Tudo CSS-only (projeto
  motion-cut): tokens de easing (`--ease-out/in/in-out`) em `globals.css` e
  `prefers-reduced-motion` tratado pela regra global existente.
- **Onde:** `src/components/cart/use-add-to-cart.ts` (hook compartilhado que
  envolve `addItem` + estado `justAdded`), `src/components/add-to-cart-button.tsx`,
  `src/components/torta-card.tsx`, `src/components/cart/cart-button.tsx`,
  `src/app/globals.css`.
- **Consequência:** qualquer novo ponto de adição ao carrinho deve usar
  `useAddToCart()` para manter o feedback consistente; a reação é client-side e
  não altera o estado do carrinho nem a validação no servidor (DEC-06).
- **Substituída por:** DEC-24 (controle de quantidade padrão de mercado).

### DEC-24 — Controle de quantidade padrão de mercado após adicionar ao carrinho
- **Status:** aceita · **Data:** 2026-08-20
- **Contexto:** o dono avaliou o feedback da DEC-23 ("Adicionado ✓" piscando e
  voltando ao normal) como ruim e pediu o padrão de mercado: após adicionar,
  exibir a quantidade com botões de aumentar, diminuir e excluir.
- **Decisão:** substitui a DEC-23 (label transitório). O componente
  `CartControls` renderiza, para cada torta: o botão **"Adicionar"** enquanto o
  item não está no carrinho; quando está, um **stepper persistente** "− quantidade
  +" (o "−" fica desabilitado na quantidade 1; "+" sempre aumenta; **excluir**
  via ícone de lixeira chama `removeItem`). O estado vem do carrinho (DEC-13),
  então vitrine e detalhe mostram a mesma quantidade e reagem a mudanças feitas
  em qualquer ponto — o morph botão→stepper é a reação visível ao adicionar. O
  bump da badge do carrinho da DEC-23 é mantido (feedback extra ao mudar
  `itemCount`).
- **Onde:** `src/components/cart/cart-controls.tsx` (novo, com variantes
  `card`/`hero`), `src/components/torta-card.tsx`,
  `src/app/tortas/[slug]/page.tsx`; removidos `add-to-cart-button.tsx` e
  `use-add-to-cart.ts` (superseded); bump em `src/components/cart/cart-button.tsx`
  e `src/app/globals.css` mantidos.
- **Consequência:** qualquer ponto de adição usa `CartControls`; a quantidade
  mínima é 1 (remover abaixo disso é só via excluir); a reação continua
  client-side, sem mudar o estado do carrinho nem a validação no servidor
  (DEC-06).

## 3. Procedimentos obrigatórios

### 3.1 Setup do ambiente (novo dev / máquina nova)
1. `npm run db:up` — sobe o PostgreSQL (Docker).
2. `copy .env.example .env` (Windows) — ajuste se necessário.
3. `npm install` — com `ignore-scripts` ativo.
4. `npx prisma generate` — gera o cliente Prisma **manualmente** (obrigatório, DEC-12).
5. `npm run db:migrate` — aplica migrations.
6. `npm run db:seed` — popula categorias e tortas (idempotente).
7. `npm run dev` — vitrine em `http://localhost:3000`, admin em `/admin`.

### 3.2 Mudança no schema do banco
1. Edite `prisma/schema.prisma`.
2. `npm run db:migrate` — gera e aplica a migration (nome descritivo via `--name`).
3. `npx prisma generate` (se o cliente mudar).
4. Atualize `docs/REGRAS-DE-NEGOCIO.md` se a mudança for de negócio; senão
   `docs/TECNICO.md` §3 (modelo de dados).

### 3.3 Integrar um gateway de pagamento real
1. Implemente `PaymentProvider` (contrato em `src/lib/payments/types.ts`).
2. Registre o provedor na factory `src/lib/payments/index.ts` (`case "nome":`).
3. Aponte `PAYMENT_PROVIDER=nome` no `.env`.
4. Crie a rota de webhook `POST /api/payments/webhook` (ou equivalente) que chame
   `provider.getStatus()` e atualize o pedido com a **mesma lógica** de
   `src/app/api/orders/[id]/pay/route.ts` (PENDING_PAYMENT → PAID + evento de auditoria).
5. Documente a integração em `docs/TECNICO.md` §8 e atualize o achado sobre o mock
   em memória.

### 3.4 Atualizar o `fable-method` vendored
1. Baixe o tarball da branch `main` de `Sahir619/fable-method`.
2. Substitua o conteúdo de `fable-method/`.
3. **Mantenha** `fable-method/LICENSE` e o README raiz do Idalino.
4. Confira se `fable-method/AGENTS.md` continua coerente com as skills.

### 3.5 Git e commits
- Nunca commitar `.env` (segredos), `.next/`, `node_modules/` — cobertos pelo
  `.gitignore`.
- Nunca commitar/pushar sem instrução explícita do usuário (diretriz dos agentes).
- Commit atômico: uma mudança lógica por commit, mensagem descritiva em pt-BR.
- Ao alterar comportamento: rode `npm run lint` e `npm run build` antes de concluir.
- Verificação por observação: rode o fluxo afetado (vitrine → checkout → pedido →
  admin) e registre o resultado, não apenas "compila".

### 3.6 Verificação antes de entregar mudança
1. `npm run lint` sem erros novos.
2. `npm run build` verde (tipos + build de produção).
3. Fluxo manual do que foi tocado (ex.: criar pedido, simular pagamento, transicionar
   status no admin).
4. Se mexeu em regra de negócio: atualize `REGRAS-DE-NEGOCIO.md`.
5. Se descobriu achado técnico ou teve intercorrência: registre em `TECNICO.md` §7/§9.
6. **Conferência obrigatória de documentação (§3.12)** — antes de declarar a tarefa
   concluída, responda às duas perguntas e registre o que for devido. Sem isso, a
   tarefa **não está concluída**.

### 3.7 Convenções de código
- **Dinheiro:** sempre inteiro em centavos, sufixo `Cents` (DEC-01); exibir com
  `formatBRL()`.
- **Idioma:** UI e mensagens de erro em pt-BR; rótulos de status em
  `src/lib/order-status.ts` (única fonte).
- **Arte:** a arte de exibição de cada torta é definida por `imageUrl` (fluxo
  regular: edição da torta). **Procedimento temporário de popularização:** enquanto
  as tortas não têm foto real, a vitrine usa fotos ilustrativas de `public/tortas/`
  atribuídas por ordem de exibição (`src/lib/torta-images.ts` — posição `i` → foto
  `i % 6`); o `emoji` (default `🍰`) é o fallback. O carrinho guarda a foto resolvida
  na adição como snapshot no item (`CartItem.imageUrl`) e exibe o mesmo thumb;
  itens antigos no `localStorage` sem o campo caem no emoji. Detalhes em `TECNICO.md` §2.
- **Fronteira server/client:** páginas que leem banco são Server Components
  `force-dynamic`; só superfícies interativas são client components (DEC-05).
- **Validação:** Zod no servidor para toda entrada (formulários e API); mensagens de
  erro amigáveis em pt-BR (`z.string().min(2, "Informe seu nome.")` etc.).
- **Organização:** rotas em `src/app/<rota>`, componentes reutilizáveis em
  `src/components/`, lógica em `src/lib/` (domínio em `src/lib/payments/`).

### 3.8 Segurança (checklist antes de produção)
- [ ] Senhas dos usuários admin fortes (nunca o default dev `idalino-admin`) e
      `ADMIN_SECRET` aleatório longo.
- [ ] `COOKIE_SECURE=true` (site em HTTPS).
- [ ] Trocar auth do admin por Auth.js/SSO (DEC-22) e adicionar rate-limit no login.
- [ ] Confirmar que nenhum segredo foi commitado (`git log -p` se necessário).

### 3.9 Processar solicitações com a skill fable-method (ferramenta complementar)
Toda solicitação de trabalho neste projeto passa pelo loop da skill fable-method
(DEC-15), na forma portátil de `fable-method/AGENTS.md` (qualquer ferramenta) ou da
skill `fable-method` (Claude Code):

1. **Classificar o pedido** — pergunta/avaliação, tarefa ou plano-primeiro; aplicar os
   gates de trivialidade e de fit antes de qualquer ação.
2. **Definir "done"** — em uma ou duas frases, com verificação nomeada e observável
   (teste passa, build verde, número muda, página renderiza).
3. **Reunir evidências** — fontes primárias (código, schema, docs, outputs reais),
   paralelizando leituras independentes; nada de memória para API/signatura/valor.
4. **Decidir** — uma recomendação; alternativas descartadas em uma linha cada.
5. **Agir cirurgicamente** — menor mudança correta; `INTENT:` antes de mudar
   comportamento; `AUTH:` antes de ação externa; `TWINS:` ao corrigir defeito.
6. **Verificar por observação** — rodar o que foi prometido (nunca inferir) + testes
   existentes do entorno; 3 ciclos de falha → parar e devolver.
7. **Reportar resultado primeiro** — primeira frase = o que aconteceu; ressalvas
   honestas; `PENDING:` para follow-up prescrito e não executado.

A skill é **complementar**: quando ela conflitar com este arquivo, este arquivo manda;
quando conflitar com instrução direta do usuário, a instrução do usuário manda.

**Antes de declarar "done" (§3.12).** O passo 6 (verificar) e o passo 7 (reportar)
do loop **não** encerram a tarefa sozinhos: antes de considerar a solicitação
concluída, aplique a **conferência obrigatória de documentação** — (1) existe
informação que deve ser registrada? (2) a documentação do projeto foi atualizada?
(procedimento completo na seção 3.12). O registro devido é parte da entrega.

**Design e layout de views (DEC-18).** Além do loop acima, **toda solicitação que
envolva design ou layout de view** — criar, alterar ou redesenhar página, tela ou
componente de UI — **deve** carregar a skill `hallmark` como ferramenta complementar
(`hallmark/SKILL.md` + as `references/` cabíveis: temas, componentes, slop-test,
anti-patterns; verbos `audit`/`redesign`/`study` quando aplicáveis) e aplicar as
regras dela ao resultado (estrutura variada, copy honesta, tokens travados,
responsividade 320–768 px, etc.). A hallmark é complementar ao fable-method: o loop
de raciocínio continua sendo o §3.9; a hallmark rege **o que** a UI deve ser.

**Formato de interação (skill `i-have-adhd`).** Toda interação do harness com o
dono do projeto **deve** seguir a estrutura obrigatória da skill
`.claude/skills/i-have-adhd/SKILL.md`: (1) **compreensão antes de processar** —
o harness apresenta o que entendeu do prompt e **para até a autorização explícita
do dono**; (2) **etapa a etapa** — após a autorização, cada etapa é anunciada
antes de executar e resumida ao concluir; (3) **resumo geral** ao final, com uma
única próxima ação se restar algo. A estrutura prevalece sobre recapitulações
vazias; as demais regras da skill (liderar com a próxima ação, listas com no
máximo 5 itens, sem preâmbulo ou encerramento vazios, estimativas de tempo
concretas) valem em toda resposta, até o dono do projeto dizer "stop adhd mode".

### 3.10 Padrões de desenvolvimento limpo e segurança (checklist de revisão)
Aplicar em toda mudança, antes de dar como concluída (DEC-16):

**Desenvolvimento limpo**
- [ ] Nomes significativos e consistentes; sem abreviações obscuras.
- [ ] Funções/componentes com uma única responsabilidade; tamanho razoável.
- [ ] Sem código morto, duplicação evitável ou "comentário de óbvio".
- [ ] Mensagens/UI em pt-BR, padrão do projeto.
- [ ] `npm run lint` e `npm run build` verdes antes de concluir.

**Segurança**
- [ ] Nenhum segredo novo no código/git; tudo via variáveis de ambiente.
- [ ] Entrada externa validada no servidor (Zod) — nunca confiar no cliente.
- [ ] Endpoints sensíveis exigem autorização (admin → sessão HMAC).
- [ ] Mudança de comportamento não enfraquece checks nem fabrica o que eles procuram.
- [ ] Nenhuma dependência adicionada sem necessidade e sem aviso.

### 3.11 Atualizar o `hallmark` vendored
1. Da raiz do projeto, rode `node hallmark/update.mjs` — baixa de novo
   `SKILL.md`, `references/` e `LICENSE` da branch `main` de
   `Nutlope/hallmark` e substitui no lugar (mantém `update.mjs`).
2. Alternativa manual: baixe `skills/hallmark/` + `LICENSE` do repositório e
   substitua o conteúdo de `hallmark/` (exceto `update.mjs`).
3. Confira se `hallmark/SKILL.md` continua coerente com `references/`.

### 3.12 Conferência obrigatória antes de declarar a tarefa concluída
> **Obrigatório e importantíssimo.** Nenhuma tarefa pode ser considerada
> realizada sem passar por esta conferência. Ela é o último passo de toda
> entrega — vale para código, análise, pesquisa, documentação e qualquer outro
> tipo de trabalho no projeto.

Antes de declarar uma tarefa concluída — e **obrigatoriamente** antes de reportar
ao dono do projeto — responda às **duas perguntas**:

**1. Existe informação que deve ser registrada?**
- Novo achado técnico ou observação relevante → `docs/TECNICO.md` §8 (achados, novo `ACH-xxx`).
- Intercorrência ocorrida → `docs/TECNICO.md` §9 (log de intercorrências, novo `INC-xxx`).
- Nova regra de negócio ou mudança em regra existente → `docs/REGRAS-DE-NEGOCIO.md`
  (nova `BR-xxx` ou atualização da `BR` afetada).
- Nova decisão de projeto ou mudança de decisão → seção 2 deste arquivo (nova `DEC-x`).
- Mudança em procedimento → seção 3 deste arquivo.

**2. A documentação do projeto foi atualizada?**
- Confira os três documentos de `docs/` (`DIRETRIZES.md`, `REGRAS-DE-NEGOCIO.md`,
  `TECNICO.md`) e o `README.md` quando a mudança afetar stack, estrutura ou uso.
- Atualize as **tabelas de controle de mudanças** de cada documento afetado
  (data + descrição da mudança).
- Trabalho que altera comportamento ou estado do sistema **sem documentação
  correspondente é considerado incompleto** — "funciona" não basta.

**Regra de ouro:** se a resposta a qualquer pergunta for "sim, há algo a
registrar/atualizar", a tarefa **não está concluída** até o registro ser feito.
Não existe check-out apressado que dispense esta conferência.

### 3.13 Verificar e atualizar as skills vendored (check de sincronia)
**Regra de gatilho:** quando o dono do projeto pedir para **atualizar** (ou
conferir) as skills vendored — em qualquer frase, ex.: "atualize as skills",
"as skills estão atualizadas?" — o agente **deve** rodar `npm run skills:check`
antes de qualquer outra ação e reportar o resultado por observação, seguindo os
passos abaixo.
1. Rode `npm run skills:check` (script `check-skills.mjs`, na raiz) — compara o
   conteúdo de `fable-method/`, `hallmark/` e `.claude/skills/i-have-adhd/` (e a
   cópia `.github/skills/i-have-adhd/`) com a branch `main` dos repositórios
   originais (Sahir619/fable-method, Nutlope/hallmark, ayghri/i-have-adhd), por
   blob SHA (git) de cada arquivo. Exit `0` = sincronizadas · `1` = divergência ·
   `2` = erro (rede/GitHub indisponível).
2. Divergências (exit `1`) indicam o que mudou no upstream; atualize pela via de
   cada skill:
   - **fable-method:** baixe o tarball da branch `main` e substitua a pasta (§3.4);
   - **hallmark:** rode `node hallmark/update.mjs` (§3.11);
   - **i-have-adhd:** baixe `skills/i-have-adhd/` de `ayghri/i-have-adhd` (branch
     `main`) e substitua `.claude/skills/i-have-adhd/` **e**
     `.github/skills/i-have-adhd/`, **reaplicando a seção local "Estrutura
     obrigatória de resposta (diretriz do projeto)"** no `SKILL.md` (o check a
     ignora por design — se ela sumir, o check sinaliza divergência).
3. Após atualizar, rode `npm run skills:check` de novo até sair `OK` (verificação
   por observação) e confira que `fable-method/AGENTS.md` e `hallmark/SKILL.md`
   continuam coerentes com o uso descrito neste arquivo.
4. Não edite o conteúdo vendored (DEC-11/DEC-17): mudanças de regra são propostas
   nos repositórios originais. Única exceção: a seção local do i-have-adhd
   (DEC-20), que é do projeto e se reaplica a cada atualização.

## 4. Controle de mudanças deste documento

| Data | Quem | Mudança |
|---|---|---|
| 2026-08-19 | Documentação | Criação do arquivo com decisões DEC-01 a DEC-14 e procedimentos 3.1–3.8 |
| 2026-08-19 | Diretrizes | Inclusão de DEC-15 (skill fable-method como ferramenta complementar), DEC-16 (desenvolvimento limpo e segurança sempre prioritários) e procedimentos 3.9–3.10 |
| 2026-08-19 | Diretrizes | Inclusão de DEC-17 (skill hallmark vendored como referência de design) e procedimento 3.11 |
| 2026-08-19 | Diretrizes | Inclusão de DEC-18 (skill hallmark como ferramenta complementar em design e layout de views) e atualização do procedimento 3.9 |
| 2026-08-19 | Diretrizes | §3.9: inclusão do skill i-have-adhd (formato de interação obrigatório com o dono do projeto) |
| 2026-08-19 | Diretrizes | Inclusão do procedimento **§3.12 — conferência obrigatória antes de declarar a tarefa concluída** (existe informação a registrar? documentação atualizada?), com referências no §3.6 e §3.9 |
| 2026-08-19 | Diretrizes | Inclusão de DEC-19 (`.hallmark/log.json` mantido versionado como histórico de design, fechando o achado ACH-12) |
| 2026-08-19 | Diretrizes | §3.7: convenção de arte — `imageUrl` (edição da torta) como fluxo regular; fotos ilustrativas de `public/tortas/` por ordem de exibição (`src/lib/torta-images.ts`) como **procedimento temporário de popularização**; `emoji` como fallback (ref. TECNICO §2; não é regra de negócio) |
| 2026-08-20 | Diretrizes | Inclusão de DEC-21 (preço de entrega por faixas de distância; motor de distância isolado em `src/lib/delivery.ts` com serviços gratuitos; ponto de saída configurável no painel; remoção de `DELIVERY_FEE_CENTS`) |
| 2026-08-20 | Diretrizes | DEC-03 marcada como `substituída`; inclusão de DEC-22 (admin com usuários: e-mail + senha com hash scrypt, sessão HMAC vinculada ao usuário, gestão em `/admin/usuarios`); §3.8 atualizado |
| 2026-08-20 | Diretrizes | DEC-22 atualizada: papéis Admin × Equipe (`AdminRole`), guardas por papel em APIs e páginas, proteções de papel (não muda o próprio papel; nunca fica sem Admin) |
| 2026-08-20 | Diretrizes | DEC-01: exemplo `DELIVERY_FEE_CENTS` removido da lista de convenção (constante inexistente desde a DEC-21); referências históricas mantidas |
| 2026-08-20 | Diretrizes | §3.7: carrinho guarda a foto resolvida na adição como snapshot no item (`CartItem.imageUrl`) e exibe o mesmo thumb da vitrine (fechando INC-02) |
| 2026-08-20 | Diretrizes | Inclusão de DEC-23 (reação visível ao adicionar torta ao carrinho: botão "Adicionado ✓" + bump da badge; hook `useAddToCart`; CSS-only com tokens de easing e reduced-motion) |
| 2026-08-20 | Diretrizes | DEC-23 marcada como `substituída`; inclusão de DEC-24 (controle de quantidade padrão de mercado: stepper "− quantidade +" + excluir via lixeira, persistente, refletindo o carrinho; `CartControls` com variantes card/hero; removidos `add-to-cart-button.tsx` e `use-add-to-cart.ts`) |
| 2026-08-20 | Diretrizes | DEC-22: endurecimento — portão central de sessão no route group `(painel)` (`src/app/admin/(painel)/layout.tsx` com `requireAdmin()`); páginas do painel movidas para o grupo (URLs inalteradas); guardas por página mantidas como defesa em profundidade (fecha relato de área admin acessível sem login — ver ACH-21 em `TECNICO.md`) |
| 2026-08-20 | Diretrizes | DEC-22: política de sessão alterada — cookie de **sessão do navegador** (sem `maxAge`), morre ao fechar o navegador; `/admin` volta a pedir login a cada abertura (decisão do dono); teto de `exp` (3 dias) mantido no token como limite máximo no servidor |
| 2026-08-20 | Diretrizes | Inclusão do procedimento **§3.13 — verificar e atualizar as skills vendored**: script `npm run skills:check` (`check-skills.mjs`, compara blobs SHA locais × upstream `main` das 3 skills), vias de atualização por skill (incluindo o i-have-adhd, que não tinha procedimento, com reaplicação da seção local do SKILL.md) |
| 2026-08-20 | Diretrizes | §3.13: **regra de gatilho** — quando o dono do projeto pedir para atualizar/conferir as skills vendored, o agente deve rodar `npm run skills:check` antes de qualquer outra ação e reportar o resultado por observação |
| 2026-08-20 | Diretrizes | DEC-20 e §3.9: formato de interação do i-have-adhd reajustado — compreensão apresentada **antes** de processar o prompt, com parada até autorização explícita do dono; após a autorização, cada etapa anunciada antes e resumida ao concluir; resumo geral ao final (seção local do `SKILL.md` nas duas cópias, `.claude` e `.github`) |

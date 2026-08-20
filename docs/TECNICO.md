# Controle Técnico — Idalino

> **Escopo deste documento:** controle de **todos os aspectos técnicos** do projeto:
> stack, arquitetura, modelo de dados, API, ambiente, segurança, **achados técnicos**
> (observações relevantes descobertas ao longo do desenvolvimento) e o **registro de
> intercorrências** (problemas ocorridos, impacto, causa e resolução).
>
> Documentos irmãos: [`DIRETRIZES.md`](DIRETRIZES.md) (decisões/procedimentos) e
> [`REGRAS-DE-NEGOCIO.md`](REGRAS-DE-NEGOCIO.md) (regras de negócio).

---

## 1. Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Full-stack | Next.js (App Router) | 16.3.1 |
| UI | React / React DOM | 19.2.8 |
| Linguagem | TypeScript | ^5 |
| Estilo | Tailwind CSS (via `@tailwindcss/postcss`) | ^4 |
| Banco de dados | PostgreSQL | 16 (`postgres:16-alpine`, Docker) |
| ORM | Prisma (`@prisma/client` + `prisma`) | ^6.19.3 |
| Validação | Zod | ^4.4.3 |
| Lint | ESLint (`eslint-config-next`) | ^9 / 16.3.1 |
| Runtime | Node.js | 20+ |
| Infra local | Docker Compose | — |

Repositório: projeto privado (`package.json` → `"private": true`), versão `0.1.0`.

## 2. Estrutura de diretórios

```
idalino/
├── prisma/
│   ├── schema.prisma      # modelos + enums do banco
│   ├── seed.mjs           # seed idempotente (3 categorias, 6 tortas)
│   └── migrations/        # migrations versionadas (geradas por prisma migrate dev)
├── src/
│   ├── app/               # rotas do App Router (Server Components por padrão)
│   │   ├── page.tsx             # vitrine (home) — force-dynamic
│   │   ├── tortas/[slug]/       # detalhe do produto
│   │   ├── carrinho/            # carrinho
│   │   ├── checkout/            # formulário de encomenda
│   │   ├── pedido/[id]/         # acompanhamento + pagamento mock
│   │   ├── admin/               # painel (login, visão geral, pedidos)
│   │   └── api/                 # orders, products, admin (login, status)
│   ├── components/        # componentes (cart, admin, torta-card, logo, botões)
│   └── lib/
│       ├── payments/      # camada de pagamento (types, mock, factory)
│       ├── prisma.ts      # singleton do Prisma Client
│       ├── auth.ts        # sessão admin (HMAC + cookie)
│       ├── admin-guard.ts # guarda de rota admin (redirect p/ login)
│       ├── order-status.ts# labels, cores e matriz de transições
│       ├── constants.ts   # DELIVERY_FEE_CENTS, APP_NAME, APP_TAGLINE, APP_LOGO_PATH
│       ├── format.ts      # formatBRL() — centavos → R$
│       └── types.ts       # CartItem, CheckoutInput (compartilhados)
├── public/logoidalino.jpg # logo da marca
├── .claude/skills/i-have-adhd/  # skill de interação c/ o dono do projeto (DIRETRIZES §3.9)
├── .github/skills/i-have-adhd/  # cópia da skill p/ GitHub Copilot (instruções de agente)
├── .hallmark/log.json   # artefato runtime da skill hallmark (log de decisões de design) — ver ACH-12
├── fable-method/          # vendored (diretriz de agentes) — ver DIRETRIZES.md DEC-11
├── hallmark/              # vendored (skill de design p/ agentes) — ver DIRETRIZES.md DEC-17
├── docker-compose.yml     # PostgreSQL 16 local
└── .env / .env.example    # variáveis de ambiente
```

## 3. Modelo de dados (Prisma)

- **Category** — categorias de produto (`name`, `slug` único).
- **Product** — `priceCents` (int), `emoji` (default `🍰`), `imageUrl?`, `categoryId?`,
  `available` (default `true`), `createdAt`.
- **Customer** — `email` único, `name`, `phone?`.
- **Order** — `code` (auto increment único), `status` (enum, default `PENDING_PAYMENT`),
  `paymentMethod` (enum, default `MOCK`), `paymentId?`, `subtotalCents`,
  `deliveryFeeCents`, `totalCents`, endereço completo, `notes?`, `productionNotes?`,
  `createdAt`/`updatedAt`. Índices em `customerId` e `status`.
- **OrderItem** — snapshot do item: `productName`, `unitPriceCents`, `quantity`;
  `productId?` (referência opcional); cascade com o pedido.
- **ProductionEvent** — auditoria de transições: `fromStatus?`, `toStatus`, `note?`,
  `createdAt`; cascade com o pedido.
- **Enums:** `OrderStatus` (PENDING_PAYMENT, PAID, IN_PRODUCTION, READY, DELIVERED,
  CANCELED) e `PaymentMethod` (MOCK, PIX, CARD).

IDs: CUID (`@default(cuid())`). Dinheiro: inteiro em centavos em todos os modelos.

## 4. API (rotas)

| Método | Rota | Auth | Propósito |
|---|---|---|---|
| GET | `/api/products` | — | Lista produtos `available` (JSON para integrações) |
| POST | `/api/orders` | — | Cria cliente + pedido + pagamento (valida com Zod, recalcula preços) |
| POST | `/api/orders/[id]/pay` | — | Simula webhook: aprova pagamento → `PAID` (só se `PENDING_PAYMENT`) |
| POST | `/api/admin/login` | — | Valida `ADMIN_PASSWORD` e emite cookie de sessão (3 dias) |
| DELETE | `/api/admin/login` | cookie | Logout (remove cookie) |
| POST | `/api/admin/orders/[id]/status` | cookie | Transição de status (valida matriz `canTransition`) |

Fluxo principal: `vitrine → carrinho (localStorage) → checkout → POST /api/orders
→ página /pedido/[id] (Pix mock) → POST /pay → admin gerencia produção`.

## 5. Variáveis de ambiente

| Variável | Default (dev) | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://idalino:idalino@localhost:5432/idalino?schema=public` | Conexão PostgreSQL |
| `ADMIN_PASSWORD` | `idalino-admin` | Senha única do painel (trocar em produção) |
| `ADMIN_SECRET` | `idalino-dev-secret` (fallback no código) | Segredo HMAC do cookie de sessão |
| `COOKIE_SECURE` | `false` | `true` quando o site estiver em HTTPS |
| `PAYMENT_PROVIDER` | `mock` | Provedor de pagamento (hoje só `mock`) |
| `DELIVERY_FEE_CENTS` | `1500` | Taxa de entrega em centavos (≥ 0; inválido → 1500) |

## 6. Comandos úteis

| Comando | Efeito |
|---|---|
| `npm run dev` | Dev server (http://localhost:3000) |
| `npm run build` / `npm start` | Build e start de produção |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Sobe/derruba o PostgreSQL (Docker) |
| `npm run db:migrate` | Cria/aplica migration (`prisma migrate dev`) |
| `npm run db:seed` | Seed idempotente |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Reseta o banco (perde dados; `--force`) |
| `npx prisma generate` | Gera o cliente Prisma (obrigatório após instalar — `ignore-scripts`) |

## 7. Segurança (estado atual e limites)

- **Sessão admin:** cookie `idalino_admin` com payload `exp=<ts>` assinado por
  HMAC-SHA256 (`timingSafeEqual` na verificação), `httpOnly`, `sameSite: lax`,
  `maxAge` 3 dias. **Limite:** senha única em texto plano comparada diretamente; sem
  rate-limit no login; sem MFA; fallback de `ADMIN_SECRET` embutido no código. Uso
  **apenas** em desenvolvimento (ver `DEC-03`).
- **Segredos:** `.env` está no `.gitignore`; `.env.example` contém apenas defaults de
  dev. Nunca commitar segredos reais.
- **Preços:** nunca confiar no cliente (revalidação no servidor — `BR-007`).
- **Checklist de produção:** `DIRETRIZES.md` §3.8.

## 8. Achados técnicos (observações registradas)

Registro acumulado de descobertas técnicas relevantes durante o desenvolvimento.
Novas descobertas entram aqui com data e referência ao código.

| ID | Data | Achado | Implicação / Recomendação |
|---|---|---|---|
| ACH-01 | 2026-08-19 | O provedor mock guarda pagamentos num `Map` **em memória** no nível do módulo (`src/lib/payments/mock.ts`). | Pagamentos somem ao reiniciar o servidor. Aceitável em dev; um gateway real persiste o estado no provedor. Registrar na integração real (§3.3 de `DIRETRIZES.md`). |
| ACH-02 | 2026-08-19 | `POST /api/orders/[id]/pay` faz "ler status → atualizar pedido" sem transação/atomicidade; duas chamadas paralelas podem aprovar duas vezes (efeito idempotente no mock, mas sem garantia formal). | Para produção, tornar a aprovação idempotente e atômica (ex.: update condicional `WHERE status = 'PENDING_PAYMENT'`). |
| ACH-03 | 2026-08-19 | `Order.productionNotes` existe no schema mas **não tem UI** no painel (campo sem interface). | Capacidade pronta; falta a tela. Não confundir com `Order.notes` (cliente). |
| ACH-04 | 2026-08-19 | Não há **testes automatizados** (unit/integration/e2e) no projeto; verificação é manual (lint, build, fluxos). | Próximo passo recomendado: ao menos testes das rotas de API (orders, pay, status) e da matriz de transições. |
| ACH-05 | 2026-08-19 | `.npmrc` com `ignore-scripts=true` (necessário em sandbox); cliente Prisma é gerado manualmente. | `npm install` em máquina nova sem `npx prisma generate` falha em runtime. Já documentado no setup. |
| ACH-06 | 2026-08-19 | Páginas que leem o banco são `force-dynamic` (sem cache). | Correto para demo de baixo tráfego; para escala, introduzir cache/revalidação por rota. |
| ACH-07 | 2026-08-19 | Autenticação do admin é nível dev (senha única, sem rate-limit, hint de senha padrão na tela de login). | Bloqueador para produção — seguir checklist `DIRETRIZES.md` §3.8. |
| ACH-08 | 2026-08-19 | `Customer.phone` não é atualizado no upsert por e-mail (fica o primeiro informado). | Comportamento atual do código; se indesejado, incluir `phone` no `update` do upsert. |
| ACH-09 | 2026-08-19 | `Order.code` usa `autoincrement` (SERIAL); após `db:reset` a numeração reinicia e pode haver "buracos" (comportamento do PostgreSQL). | Não usar `code` como referência contábil; é exibição amigável. |
| ACH-10 | 2026-08-19 | Categoria é **opcional** no produto (`categoryId` nulo) e não há gestão de catálogo no painel (produtos são geridos via banco/seed). | Restrição de produto, não bug; avaliar CRUD de catálogo no admin quando necessário. |
| ACH-11 | 2026-08-19 | O painel admin permite transicionar `PENDING_PAYMENT → PAID` **sem** confirmação do gateway (override manual via `POST /api/admin/orders/[id]/status` — a matriz `canTransition` autoriza e a rota não checa pagamento). | Garantia de "pagar antes de produzir" vale só para o fluxo do cliente. Quando o gateway real entrar, decidir se o override permanece (ex.: pedido pago offline) ou passa a exigir confirmação/justificativa. Ver BR-003. |
| ACH-12 | 2026-08-19 | A skill hallmark grava `/.hallmark/log.json` na raiz do projeto — log runtime de decisões de design (brief, macroestrutura, tema) — e o arquivo **não está no `.gitignore`** (aparece como untracked no `git status`). | **Decidido (2026-08-19): manter versionado** como histórico de design enquanto as views evoluem (decisão DEC-19 em `DIRETRIZES.md`). Reavaliar quando o design estabilizar: se virar ruído, adicionar `/.hallmark/` ao `.gitignore`. |
| ACH-13 | 2026-08-19 | Sistema de design implementado em `src/app/globals.css` via Tailwind `@theme inline` com **tokens oklch** (papel/ink/muted/accent rosé/focus) e fontes **Fraunces + Geist**, aplicado às views (redesign hallmark, DEC-18). | Manter os tokens centralizados no `@theme`; não espalhar cores/fontes hardcoded nas views. Alterações de identidade visual devem tocar `globals.css` (+ `src/lib/constants.ts`), nunca páginas. |

## 9. Registro de intercorrências

Formato de registro — **cada ocorrência** entra como uma linha nova na tabela, com
data, sintoma, causa, impacto e resolução. Nunca sobrescrever ocorrência antiga.

| ID | Data | Descrição / Sintoma | Causa raiz | Impacto | Resolução / Status |
|---|---|---|---|---|---|
| — | — | *(nenhuma intercorrência registrada até 2026-08-19)* | — | — | — |

## 10. Controle de mudanças deste documento

| Data | Quem | Mudança |
|---|---|---|
| 2026-08-19 | Documentação | Criação do documento (stack, modelo, API, ambiente, achados ACH-01..11, log de intercorrências) |
| 2026-08-19 | Documentação | §2: inclusão de `.claude/skills/i-have-adhd`, `.github/skills/i-have-adhd` e `.hallmark/log.json` na estrutura; achado ACH-12 (artefato runtime da hallmark fora do .gitignore) |
| 2026-08-19 | Documentação | ACH-12: decisão de manter `.hallmark/log.json` versionado (DEC-19 em DIRETRIZES.md) |
| 2026-08-19 | Documentação | Achado ACH-13 (sistema de design em tokens oklch + Fraunces/Geist em `globals.css`, redesign hallmark) |

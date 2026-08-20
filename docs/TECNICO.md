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
│   ├── seed.mjs           # seed idempotente (categorias, tortas, faixas de entrega, admin inicial)
│   └── migrations/        # migrations versionadas (geradas por prisma migrate dev)
├── src/
│   ├── app/               # rotas do App Router (Server Components por padrão)
│   │   ├── page.tsx             # vitrine (home) — force-dynamic
│   │   ├── tortas/[slug]/       # detalhe do produto
│   │   ├── carrinho/            # carrinho
│   │   ├── checkout/            # formulário de encomenda (retirada × entrega)
│   │   ├── pedido/[id]/         # acompanhamento + pagamento mock
│   │   ├── admin/               # painel — login fora do grupo; demais telas em `(painel)/` (route group: URLs idênticas, protegidas pelo layout)
│   │   └── api/                 # orders, products, delivery/quote, admin (login, usuários, ...)
│   ├── components/        # componentes (cart, admin, torta-card, logo, botões)
│   └── lib/
│       ├── payments/      # camada de pagamento (types, mock, factory)
│       ├── prisma.ts      # singleton do Prisma Client
│       ├── auth.ts        # sessão admin por usuário (HMAC + uid)
│       ├── admin-guard.ts # guardas de rota admin (login + papel)
│       ├── admin-users.ts # hash scrypt e validação (Zod) dos usuários admin
│       ├── order-status.ts# labels, cores e matriz de transições
│       ├── constants.ts   # APP_NAME, APP_TAGLINE, APP_LOGO_PATH
│       ├── delivery.ts    # motor de distância da entrega (CEP → coordenadas → faixa)
│       ├── delivery-fees-admin.ts # validação (Zod) das faixas e do ponto de saída
│       ├── torta-images.ts# fotos ilustrativas da vitrine (atribuição por ordem de exibição)
│       ├── slugify.ts     # slug a partir de nome em pt-BR
│       ├── products-admin.ts # validação (Zod) e slug único das tortas no painel
│       ├── format.ts      # formatBRL() — centavos → R$; formatKm()/formatGrams()
│       └── types.ts       # CartItem, CheckoutInput (compartilhados)
├── public/logoidalino.jpg # logo da marca
├── public/tortas/         # fotos ilustrativas das tortas (vitrine); uploads do painel em public/tortas/upload (gitignored)
├── .claude/skills/i-have-adhd/  # skill de interação c/ o dono do projeto (DIRETRIZES §3.9; agents/ p/ Gemini/OpenAI)
├── .github/skills/i-have-adhd/  # cópia da skill p/ GitHub Copilot (instruções de agente)
├── .hallmark/log.json   # artefato runtime da skill hallmark (log de decisões de design) — ver ACH-12
├── fable-method/          # vendored (diretriz de agentes) — ver DIRETRIZES.md DEC-11
├── hallmark/              # vendored (skill de design p/ agentes) — ver DIRETRIZES.md DEC-17
├── check-skills.mjs       # verifica sincronia das skills vendored × upstream (npm run skills:check; DIRETRIZES §3.13)
├── docker-compose.yml     # PostgreSQL 16 local
└── .env / .env.example    # variáveis de ambiente
```

**Procedimento temporário — fotos ilustrativas da vitrine (2026-08-19).** Enquanto
as tortas não têm foto real, a vitrine (`src/app/page.tsx`) e a página de detalhe
(`src/app/tortas/[slug]/page.tsx`) exibem fotos ilustrativas de `public/tortas/`
atribuídas **por ordem de exibição** via `tortaImageForSlug()` em
`src/lib/torta-images.ts` (produto na posição `i` da listagem recebe
`TORTA_IMAGES[i % 6]`). Quando `Product.imageUrl` estiver preenchida, ela prevalece
sobre a atribuição automática; sem foto alguma, cai para o `emoji`. O carrinho
(`src/app/carrinho/page.tsx`) guarda a **foto resolvida na adição** como snapshot no
item (`CartItem.imageUrl` — mesma regra da vitrine) e exibe o mesmo thumb nos itens;
itens antigos no `localStorage`, sem o campo, caem no emoji. Este é um
procedimento de popularização, **não uma regra de negócio** (BR-024): o fluxo
regular é a **edição de cada torta no painel** (`/admin/tortas`, campo Imagem) — ver BR-027.

## 3. Modelo de dados (Prisma)

- **Category** — categorias de produto (`name`, `slug` único).
- **Product** — `priceCents` (int), `weightGrams?` (int, gramas — migration
  `20260820020529_add_product_weight_grams`), `emoji` (default `🍰`), `imageUrl?`,
  `categoryId?`, `available` (default `true`), `createdAt`.
- **Customer** — `email` único, `name`, `phone?`.
- **Order** — `code` (auto increment único), `status` (enum, default `PENDING_PAYMENT`),
  `paymentMethod` (enum, default `MOCK`), `deliveryType` (enum `DELIVERY | PICKUP`,
  default `DELIVERY`), `paymentId?`, `subtotalCents`, `deliveryFeeCents`,
  `deliveryDistanceKm?` (snapshot da distância calculada), `totalCents`, endereço
  **opcional** (nulo na retirada), `notes?`, `productionNotes?`, `createdAt`/`updatedAt`.
  Índices em `customerId` e `status`.
- **OrderItem** — snapshot do item: `productName`, `unitPriceCents`, `quantity`;
  `productId?` (referência opcional); cascade com o pedido.
- **ProductionEvent** — auditoria de transições: `fromStatus?`, `toStatus`, `note?`,
  `createdAt`; cascade com o pedido.
- **DeliveryFeeRange** — faixa de preço da entrega: `minKm` (inclusivo), `maxKm?`
  (exclusivo; nulo = faixa aberta), `priceCents` (int); validação de conjunto
  (sem sobreposição, no máx. uma faixa aberta por último) em
  `src/lib/delivery-fees-admin.ts`.
- **StoreSettings** — ponto de saída da loja, linha única (`id` fixo `"store"`):
  `cep`, `lat`/`lng` (resolvidos no salvamento), endereço de exibição opcional
  (`street?`, `number?`, `neighborhood?`, `city?`, `state?`).
- **AdminUser** — usuário do painel: `name`, `email` único (minúsculas),
  `passwordHash` (scrypt `salt:hash` em hex — nunca texto puro), `role`
  (`AdminRole`: `ADMIN` acesso total · `TEAM` só visão geral e pedidos),
  `createdAt`/`updatedAt`.
- **Enums:** `OrderStatus` (PENDING_PAYMENT, PAID, IN_PRODUCTION, READY, DELIVERED,
  CANCELED), `PaymentMethod` (MOCK, PIX, CARD) e `DeliveryType` (DELIVERY, PICKUP).

IDs: CUID (`@default(cuid())`). Dinheiro: inteiro em centavos em todos os modelos.

## 4. API (rotas)

| Método | Rota | Auth | Propósito |
|---|---|---|---|
| GET | `/api/products` | — | Lista produtos `available` (JSON para integrações) |
| POST | `/api/orders` | — | Cria cliente + pedido + pagamento (valida com Zod, recalcula preços; taxa de entrega por faixa — DEC-06) |
| POST | `/api/orders/[id]/pay` | — | Simula webhook: aprova pagamento → `PAID` (só se `PENDING_PAYMENT`) |
| GET | `/api/delivery/quote?cep=...` | — | Cotação da entrega para um CEP (prévia no checkout; distância + taxa da faixa) |
| POST | `/api/admin/login` | — | Valida **e-mail + senha** de um usuário admin (AdminUser) e emite **cookie de sessão** (sem `maxAge` — morre ao fechar o navegador; teto de 3 dias apenas no `exp` do token) |
| DELETE | `/api/admin/login` | cookie | Logout (remove cookie) |
| GET | `/api/admin/session` | cookie | Nome do usuário admin logado (cabeçalho do painel) |
| POST | `/api/admin/users` | cookie + ADMIN | Cria usuário admin (e-mail único; senha com hash scrypt; papel default `TEAM`) |
| PATCH | `/api/admin/users/[id]` | cookie + ADMIN | Atualiza usuário admin (senha ausente = mantém; não muda o próprio papel; não deixa sem Admin) |
| DELETE | `/api/admin/users/[id]` | cookie + ADMIN | Exclui usuário admin (não exclui a si mesmo nem o último) |
| POST | `/api/admin/orders/[id]/status` | cookie | Transição de status (valida matriz `canTransition`) |
| POST | `/api/admin/products` | cookie | Cria torta (Zod; slug automático único) |
| PATCH | `/api/admin/products/[id]` | cookie | Atualiza torta (parcial; regenera slug se o nome mudar) |
| DELETE | `/api/admin/products/[id]` | cookie | Exclui torta (pedidos antigos preservam snapshot) |
| POST | `/api/admin/products/image` | cookie | Upload de imagem (multipart "file"; JPG/PNG/WebP ≤ 5 MB, valida magic bytes) → retorna caminho público |
| PATCH | `/api/admin/delivery/settings` | cookie | Salva o ponto de saída da loja (resolver CEP → coordenadas; upsert linha `store`) |
| POST | `/api/admin/delivery-fees` | cookie | Cria faixa de entrega (valida conjunto: sem sobreposição, uma faixa aberta por último) |
| PATCH | `/api/admin/delivery-fees/[id]` | cookie | Atualiza faixa (mesclada + validação do conjunto) |
| DELETE | `/api/admin/delivery-fees/[id]` | cookie | Exclui faixa (pedidos antigos preservam a taxa cobrada) |

Fluxo principal: `vitrine → carrinho (localStorage) → checkout → POST /api/orders
→ página /pedido/[id] (Pix mock) → POST /pay → admin gerencia produção`.

## 5. Variáveis de ambiente

| Variável | Default (dev) | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://idalino:idalino@localhost:5432/idalino?schema=public` | Conexão PostgreSQL |
| `ADMIN_SECRET` | `idalino-dev-secret` (fallback no código) | Segredo HMAC do cookie de sessão |
| `COOKIE_SECURE` | `false` | `true` quando o site estiver em HTTPS |
| `PAYMENT_PROVIDER` | `mock` | Provedor de pagamento (hoje só `mock`) |

*(A taxa de entrega deixou de ser ambiente: agora é configurada por faixas de
distância no painel `/admin/entregas` — ver `REGRAS-DE-NEGOCIO.md` BR-010.
`ADMIN_PASSWORD` também deixou de ser usado: o acesso é por usuários admin
criados no seed (`admin@idalino.local` / `idalino-admin`, dev) e geridos em
`/admin/usuarios` — DEC-22.)*

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

> **Nota:** `npx prisma generate` falha com `EPERM` (rename da DLL do query
> engine) enquanto o dev server estiver rodando — o processo segura o arquivo.
> Pare o `npm run dev` antes de gerar o cliente (ocorrido em 2026-08-20, INC-01
> em §9).

## 7. Segurança (estado atual e limites)

- **Sessão admin:** cookie `idalino_admin` com payload `exp=<ts>&uid=<id>` assinado por
  HMAC-SHA256 (`timingSafeEqual` na verificação), `httpOnly`, `sameSite: lax`,
  **cookie de sessão do navegador** (sem `maxAge`/`expires` — morre ao fechar o
  navegador; decisão do dono em 2026-08-20). O `exp` do token (3 dias,
  `SESSION_DAYS`) é apenas o teto máximo no servidor. O login valida e-mail +
  senha contra `AdminUser` (hash scrypt do
  Node, `src/lib/admin-users.ts`). **Limites:** sem rate-limit no login; sem MFA;
  fallback de `ADMIN_SECRET` embutido no código; sessões emitidas antes da DEC-22
  (sem `uid`) exigem novo login. Uso **apenas** em desenvolvimento (ver `DEC-03`/`DEC-22`).
- **Portão central do painel:** todas as páginas admin vivem no route group
  `src/app/admin/(painel)/`, cujo `layout.tsx` chama `requireAdmin()` — a exigência
  de sessão vale **por construção** para qualquer rota sob `/admin` (exceto
  `/admin/login`), independentemente da guarda individual de cada página
  (mantidas como defesa em profundidade; ver ACH-21).
- **Segredos:** `.env` está no `.gitignore`; `.env.example` contém apenas defaults de
  dev. Nunca commitar segredos reais.
- **Preços:** nunca confiar no cliente (revalidação no servidor — `BR-007`).
- **Checklist de produção:** `DIRETRIZES.md` §3.8.

## 8. Achados técnicos (observações registradas)

Registro acumulado de descobertas técnicas relevantes durante o desenvolvimento.
Novas descobertas entram aqui com data e referência ao código.

| ID | Data | Achado | Implicação / Recomendação |
|---|---|---|---|
| ACH-01 | 2026-08-19 | O provedor mock guarda pagamentos num `Map` **em memória** no nível do módulo (`src/lib/payments/mock.ts`). **Obs. (2026-08-20):** o código Pix fake tem o valor **fixo** ("689.90") independente do total real do pedido — é apenas ilustrativo; o valor oficial é `Order.totalCents`. | Pagamentos somem ao reiniciar o servidor. Aceitável em dev; um gateway real persiste o estado no provedor. Registrar na integração real (§3.3 de `DIRETRIZES.md`). |
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
| ACH-14 | 2026-08-19 | Carrinho (`src/components/cart/cart-context.tsx`) usa **hidratação SSR-safe**: estado inicial vazio de propósito (casa com o HTML do servidor) + leitura única do `localStorage` após a montagem; a regra `set-state-in-effect` é suprimida com `eslint-disable` justificado (commit `0794ea6`). | Padrão canônico de hidratação client-only em Next.js — preservar ao mexer no carrinho; não "corrigir" o `set-state-in-effect` removendo a supressão. |
| ACH-15 | 2026-08-20 | CRUD de tortas no painel implementado: telas `/admin/tortas` (lista/novo/editar) e rotas `POST/PATCH/DELETE /api/admin/products` com validação Zod; campo `Product.weightGrams` (migration `20260820020529_add_product_weight_grams`); seed com pesos; `next.config.ts` com `remotePatterns` https; slug automático a partir do nome (`src/lib/slugify.ts`). **Fecha ACH-10** (gestão de catálogo). | Imagem ainda é por URL (campo de texto + prévia); upload de arquivo fica como melhoria futura. Exclusão de torta preserva pedidos antigos (snapshot DEC-08). |
| ACH-16 | 2026-08-20 | Upload de imagem no formulário de tortas: rota `POST /api/admin/products/image` salva em `public/tortas/upload/` (JPG/PNG/WebP ≤ 5 MB, validação por magic bytes, nome aleatório) e retorna o caminho público; normalização de `/public/` digitado por engano no `imageUrl` (`normalizeImageUrl` em `src/lib/products-admin.ts`); componente `TortaImage` com fallback para o emoji quando a imagem falha (vitrine, detalhe e lista admin). | Corrige o caso real: caminho `/public/tortas/...` salvo pelo dono gerava 404 e só o placeholder aparecia; valor já salvo foi normalizado no banco. `public/tortas/upload/` está no `.gitignore`. |
| ACH-17 | 2026-08-20 | Motor de distância da entrega (migration `20260820153925_add_delivery_fees`): `DeliveryFeeRange` + `StoreSettings` + `Order.deliveryType`/`deliveryDistanceKm`/endereço opcional; motor isolado em `src/lib/delivery.ts` usando serviços **gratuitos sem chave** — AwesomeAPI CEP (coordenadas) com fallback **Nominatim/OSM por `postalcode=`** (o texto livre "CEP X Brasil" devolvia correspondência fuzzy incorreta — ver INC-01) — e distância em **linha reta (haversine)**, com cache em memória. | **Limitações conhecidas:** distância aproximada (linha reta × CEP, não rota real); dependência de serviços gratuitos sem SLA (timeout de 5 s por chamada; fallback Nominatim limitado a 1 req/s). **CEPs ausentes da base da AwesomeAPI e sem postcode no OSM são recusados como "CEP inválido"** mesmo sendo válidos (ex.: 04000000, Ibirapuera/SP). Para produção, trocar o motor por provedor preciso (ex.: Google Distance Matrix) — ver decisão DEC-21. |
| ACH-18 | 2026-08-20 | Auth do admin migrou de senha única para usuários (migration `20260820160934_add_admin_users`): modelo `AdminUser` com `passwordHash` **scrypt** do Node (`salt:hash`, `timingSafeEqual`) — sem dependência externa; sessão HMAC agora carrega `uid`; rotas `/api/admin/users` e `/api/admin/session`; tela `/admin/usuarios`; seed cria `admin@idalino.local` / `idalino-admin` (dev; nunca sobrescreve senha alterada). `ADMIN_PASSWORD` ficou **inerte** no `.env` (o login não o lê mais). | **Limites:** continua nível dev — sem rate-limit no login, sem MFA; produção deve trocar por Auth.js/SSO (DEC-22). Sessões antigas (sem `uid`) exigem novo login. A implementação substitui a DEC-03. |
| ACH-19 | 2026-08-20 | Papéis admin (migration `20260820162056_add_admin_role`): enum `AdminRole` (`ADMIN` \| `TEAM`) em `AdminUser`; guardas por papel — `checkAdminRole()`/`roleDeniedResponse()` nas APIs (401/403) e `requireAdminRole()` nas páginas (redirect p/ `/admin`); telas/rotas de tortas, entregas e usuários exigem `ADMIN`; status de pedido segue acessível a `TEAM`; novo usuário nasce `TEAM`; proteções de papel no PATCH (não muda o próprio papel; não deixa o painel sem Admin). | Navegação do header filtra links por papel (via `/api/admin/session` → `role`). Nenhum impacto no fluxo público/checkout. |
| ACH-20 | 2026-08-20 | O `.env` de dev tem `ADMIN_PASSWORD="idalino-admin"` **com aspas literais**: o valor carregado em `process.env` incluiu as aspas (o login antigo de senha única só aceitava a senha digitada **com** as aspas). Com a DEC-22 a variável ficou inerte (login por usuário em banco), mas o quirk vale para qualquer outra variável do `.env`. | Não é bug do código — é como o valor foi gravado no arquivo. Ao editar `.env`, gravar valores **sem aspas** quando o consumidor não as esperar (senhas/secrets); conferir o valor efetivo após o load. |
| ACH-21 | 2026-08-20 | **Relato do dono: área admin acessível sem login** ("basta adicionar /admin"). Verificado por observação que a fonte atual **já protegia** todas as páginas (`requireAdmin`/`requireAdminRole`) e rotas API admin; o relato não reproduz na fonte atual (dev e produção recompilada respondem `307 → /admin/login`). Duas vulnerabilidades de classe: (1) a exigência de login era **por convenção** — dependia de cada página lembrar da guarda (página nova esquecida = área aberta); (2) build de produção `.next` anterior às últimas alterações servia estado antigo. | **Endurecimento aplicado:** páginas admin movidas para o route group `src/app/admin/(painel)/` (URLs inalteradas) com `layout.tsx` chamando `requireAdmin()` — login obrigatório **por construção** para toda rota sob `/admin`, exceto `/admin/login` (fora do grupo). Guardas por página mantidas (defesa em profundidade). Verificado: sem cookie → `307` em todas as páginas; cookie inválido → `307`; cookie com assinatura válida → `200` (dashboard renderiza); `/admin/login` → `200`; lint e build verdes. |
| ACH-22 | 2026-08-20 | **GUI do DeepSeek Harness customizada para o dono** (fora deste repositório, no checkout global): em `%APPDATA%\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-client-ui-conversation\lib\client.js`, o `ChatView` passou a **agrupar as chamadas de ferramenta consecutivas de cada turno** numa única linha recolhível "N chamadas de ferramenta" (clique expande; auto-abre enquanto roda, quando há erro ou quando a chamada está selecionada; bolinha vermelha no cabeçalho se algo falhou). O "Think" virou um chip compacto (só o rótulo) quando concluído — o resumo da primeira linha aparece apenas durante a execução; clique expande o raciocínio. | **Como funciona/reaplicar:** os client plugins são servidos do disco (`/plugins/@deepseek-ai/*/client.js`), e o `window.__DSH_BOOT__` (injetado no index.html a cada request) regenera o `rev` — editar o arquivo + dar refresh aplica, **sem rebuild Vite**. Qualquer `npm update`/reinstalação do `@deepseek-ai` restaura o original e exige reaplicar o patch (não há overlay no shell). Verificação por observação: `node --check` no arquivo, hash servido = hash local, `rev` do plugin muda no boot manifest. |

## 9. Registro de intercorrências

Formato de registro — **cada ocorrência** entra como uma linha nova na tabela, com
data, sintoma, causa, impacto e resolução. Nunca sobrescrever ocorrência antiga.

| ID | Data | Descrição / Sintoma | Causa raiz | Impacto | Resolução / Status |
|---|---|---|---|---|---|
| — | — | *(nenhuma intercorrência registrada até 2026-08-19)* | — | — | — |
| INC-01 | 2026-08-20 | **Cotações de entrega erradas:** vários CEPs (ex.: 04000000, 90000000, 99999999) devolviam a **mesma distância (~246 km)** e a mesma taxa, independentemente do CEP. | O fallback do motor de distância usava busca por **texto livre** no Nominatim ("CEP X Brasil"), que retornava correspondência **fuzzy** — um prédio em Araraquara/SP — para qualquer CEP não encontrado na AwesomeAPI. | Pedidos de entrega para CEPs fora da base da AwesomeAPI seriam precificados com distância (e taxa) erradas. | Trocado para a busca **por `postalcode=`** no Nominatim (precisa); CEPs sem correspondência agora são recusados com "CEP inválido" (comportamento intencional, BR-031). Verificado por observação (quotes de CEPs próximos/distantes) em 2026-08-20. |
| INC-02 | 2026-08-20 | **Thumb do carrinho sem a foto da torta:** no `/carrinho`, o item exibia só o `emoji` (🍰) onde deveria estar a foto — "imagem da torta não correta" relatada pelo dono. | `CartItem` não tinha campo de imagem, as duas entradas de adição (`TortaCard` e `AddToCartButton`) não guardavam a foto e a página do carrinho renderizava apenas `item.emoji`. | Thumb não identificava a torta (todos os itens com a mesma carinha), divergindo da vitrine e do detalhe — único ponto do fluxo público afetado. | `CartItem.imageUrl?` (snapshot da foto resolvida na adição — mesma regra da vitrine: `imageUrl` real → ilustrativa por ordem → emoji); thumbs passaram a usar `TortaImage` com fallback. **Twin check:** vitrine/detalhe já resolviam corretamente; checkout e pedido não exibem thumb; lista admin mostra o `imageUrl` real (intencional). Verificado com lint/build verdes e smoke test (home com 5 fotos, `/carrinho` 200); conferência visual do thumb no navegador fica pendente (carrinho é client-side). |

## 10. Controle de mudanças deste documento

| Data | Quem | Mudança |
|---|---|---|
| 2026-08-19 | Documentação | Criação do documento (stack, modelo, API, ambiente, achados ACH-01..11, log de intercorrências) |
| 2026-08-19 | Documentação | §2: inclusão de `.claude/skills/i-have-adhd`, `.github/skills/i-have-adhd` e `.hallmark/log.json` na estrutura; achado ACH-12 (artefato runtime da hallmark fora do .gitignore) |
| 2026-08-19 | Documentação | ACH-12: decisão de manter `.hallmark/log.json` versionado (DEC-19 em DIRETRIZES.md) |
| 2026-08-19 | Documentação | Achado ACH-13 (sistema de design em tokens oklch + Fraunces/Geist em `globals.css`, redesign hallmark) |
| 2026-08-19 | Documentação | Revisão das sessões do dia: achado ACH-14 (hidratação SSR-safe do carrinho, commit `0794ea6`); §2 com nota da pasta `agents/` da skill i-have-adhd |
| 2026-08-19 | Documentação | §2: `public/tortas/` (fotos ilustrativas) e `src/lib/torta-images.ts` — **procedimento temporário de popularização** por ordem de exibição (não é regra de negócio; fluxo regular: edição da torta via `imageUrl`) |
| 2026-08-20 | Documentação | CRUD de tortas no admin (fecha ACH-10): campo `weightGrams` (migration `20260820020529_add_product_weight_grams`), rotas `/api/admin/products`, telas `/admin/tortas` (lista/novo/editar), seed com pesos, `next.config.ts` com `remotePatterns` https; achado ACH-15 |
| 2026-08-20 | Documentação | Upload de imagem no formulário de tortas (rota `POST /api/admin/products/image`, validação por magic bytes, `public/tortas/upload/` gitignored); normalização de `/public/` no `imageUrl`; componente `TortaImage` com fallback de emoji; achado ACH-16 |
| 2026-08-20 | Documentação | Preço de entrega por faixas de distância: migration `20260820153925_add_delivery_fees` (`DeliveryFeeRange`, `StoreSettings`, `Order.deliveryType` + `deliveryDistanceKm` + endereço opcional), rotas `/api/delivery/quote` e `/api/admin/delivery-fees(+/[id])` e `/api/admin/delivery/settings`, telas `/admin/entregas` (novo/editar), motor em `src/lib/delivery.ts` (AwesomeAPI + Nominatim + haversine), remoção de `DELIVERY_FEE_CENTS`; achado ACH-17 |
| 2026-08-20 | Documentação | Usuários admin: migration `20260820160934_add_admin_users` (modelo `AdminUser`, hash scrypt), login por e-mail + senha, rotas `/api/admin/users(+/[id])` e `/api/admin/session`, tela `/admin/usuarios`, seed do admin inicial; `ADMIN_PASSWORD` inerte no `.env`; achado ACH-18 |
| 2026-08-20 | Documentação | Papéis admin: migration `20260820162056_add_admin_role` (enum `AdminRole`), guardas por papel em APIs e páginas (tortas/entregas/usuários exigem ADMIN; pedidos acessível a TEAM), formulário/lista com papel, header filtra links; achado ACH-19 |
| 2026-08-20 | Documentação | Revisão das sessões do dia: §2 (estrutura) e §5 sem `ADMIN_PASSWORD` (inerte); §6 com nota do EPERM no `prisma generate` (dev server aberto); ACH-01 com obs. do valor fixo do Pix mock; ACH-17 atualizado (fallback por postalcode; CEPs irresolvíveis recusados); achado ACH-20 (aspas literais no `.env`); **INC-01** (fallback de texto livre do Nominatim com distâncias erradas) |
| 2026-08-20 | Documentação | §2: carrinho guarda a foto resolvida na adição (`CartItem.imageUrl`, snapshot) e exibe o mesmo thumb da vitrine; **INC-02** (thumb do carrinho sem a foto da torta — só emoji) |
| 2026-08-20 | Documentação | Portão central de sessão do painel: páginas admin movidas para `src/app/admin/(painel)/` com layout chamando `requireAdmin()` (URLs inalteradas; `/admin/login` fora do grupo); §2 e §7 atualizados; achado ACH-21 (relato de área admin sem login — não reproduz na fonte atual; endurecimento estrutural) |
| 2026-08-20 | Documentação | Política de sessão: cookie admin passou a ser **cookie de sessão do navegador** (sem `maxAge` — morre ao fechar o navegador; `/admin` pede login a cada abertura); `exp` do token (3 dias) vira teto máximo no servidor; §4 (API) e §7 (segurança) atualizados |
| 2026-08-20 | Documentação | §2: inclusão de `check-skills.mjs` — verificação de sincronia das skills vendored × upstream (npm run `skills:check`; procedimento §3.13 em DIRETRIZES) |
| 2026-08-20 | Documentação | Achado ACH-22: GUI do Harness customizada (fora do repo) — no `ChatView` do `dsh-client-ui-conversation`, chamadas de ferramenta do chat agrupadas por turno numa linha recolhível "N chamadas de ferramenta" (auto-abre em running/erro/seleção; bolinha vermelha em erro); plugin servido do disco → edição + refresh, sem rebuild; reaplicar após `npm update` do `@deepseek-ai` |

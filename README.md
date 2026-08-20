# 🥧 Idalino

**Site de vitrine digital para uma fábrica de tortas.** Encomendas online com
pagamento digital (atualmente simulado) e um painel administrativo para
gerenciar a produção dos pedidos.

## ✨ Funcionalidades

- **Vitrine** — catálogo de tortas com categorias, preços e detalhes
- **Carrinho + Checkout** — encomenda com escolha de **retirar na loja ou
  receber em casa** (taxa de entrega calculada pela distância do CEP até a loja)
- **Pagamento mock** — fluxo Pix simulado (pronto para plugar um gateway real)
- **Acompanhamento** — o cliente vê o status do pedido e o histórico
- **Painel admin** — visão geral, gestão de produção (pago → em produção →
  pronto → entregue), catálogo de tortas, faixas de entrega e **usuários com
  papéis** (Admin × Equipe)

## 🧱 Stack

| Camada        | Tecnologia                                      |
| ------------- | ----------------------------------------------- |
| Full-stack    | Next.js 16 (App Router) + TypeScript + Tailwind |
| Banco de dados| PostgreSQL 16 (Docker) + Prisma ORM             |
| Validação     | Zod                                             |
| Pagamentos    | **Mock** (interface desacoplada)                |

## 🚀 Como rodar

Pré-requisitos: **Node 20+**, **Docker** (com Compose).

```bash
# 1. Suba o banco de dados (use `docker compose up -d` se o plugin estiver
#    disponível na sua instalação do Docker)
npm run db:up

# 2. Configure o ambiente (já existe .env para dev; ajuste se precisar)
cp .env.example .env   # Windows: copy .env.example .env

# 3. Instale as dependências
npm install

# 4. Gere o cliente Prisma, crie as tabelas e popule (tortas, faixas de
#    entrega e o usuário admin inicial)
npx prisma generate
npm run db:migrate
npm run db:seed

# 5. Rode em desenvolvimento
npm run dev
```

Acesse:

- Vitrine: http://localhost:3000
- Painel admin: http://localhost:3000/admin — login com **e-mail + senha** de um
  usuário admin. O seed cria o primeiro (`admin@idalino.local` / `idalino-admin`,
  nível dev); gerencie usuários e papéis em `/admin/usuarios`.

> Se a porta 5432 estiver ocupada, troque a porta no `docker-compose.yml` e a
> `DATABASE_URL` no `.env` de forma correspondente.

## 💳 Pagamento (mock)

A camada de pagamento está isolada em `src/lib/payments/` e expõe apenas a
interface `PaymentProvider`. O provedor atual (`mock`) simula:

1. Criação do pagamento com **status `pending`** e um **código Pix fake**
2. Aprovação manual pelo botão **"Simular pagamento aprovado"** na página do
   pedido (equivale ao webhook de confirmação de um gateway real)

Para integrar um gateway real (Mercado Pago, Stripe, Pagar.me...):

1. Implemente `PaymentProvider` (veja `src/lib/payments/types.ts`)
2. Registre o provedor na factory `src/lib/payments/index.ts`
3. Troque `PAYMENT_PROVIDER` no `.env` (ex.: `mercadopago`)
4. No gateway real, a confirmação chega por **webhook** — crie uma rota
   `POST /api/payments/webhook` que chame `provider.getStatus()` e atualize o
   pedido (mesma lógica de `src/app/api/orders/[id]/pay/route.ts`)

Nenhuma outra parte do código precisa mudar.

## 📁 Estrutura

```
.claude/skills/          # skill i-have-adhd — formato de interação c/ o dono do projeto
.github/skills/          # cópia da skill p/ GitHub Copilot
.hallmark/               # log de decisões de design gerado pela skill hallmark (runtime)
docs/                    # documentação do projeto
  DIRETRIZES.md          # decisões do projeto e procedimentos obrigatórios
  REGRAS-DE-NEGOCIO.md   # controle das regras de negócio (BR-xxx)
  TECNICO.md             # stack, arquitetura, achados e intercorrências
fable-method/            # método de raciocínio p/ agentes de IA (vendored)
  AGENTS.md              # instruções do método (qualquer ferramenta)
  skills/                # fable-method, fable-loop, fable-judge, fable-domain
  eval/                  # cenários de avaliação (traps) e resultados
hallmark/                # skill de design anti-AI-slop p/ agentes (vendored)
  SKILL.md + references/ # regras de design; LICENSE (MIT); update.mjs
prisma/
  schema.prisma        # modelos: produtos, clientes, pedidos, faixas de entrega, usuários admin
  seed.mjs             # tortas, faixas de entrega e admin inicial de exemplo
src/
  app/
    page.tsx           # vitrine (home)
    tortas/[slug]      # detalhe do produto
    carrinho           # carrinho
    checkout           # formulário de encomenda (retirada × entrega)
    pedido/[id]        # acompanhamento + pagamento mock
    admin/             # painel — login fora do grupo; demais telas em (painel)/ (protegidas pelo layout)
    api/               # orders, products, delivery/quote, admin (login, usuários, ...)
  components/          # carrinho (context), cards, admin
  lib/
    payments/          # camada de pagamento (interface + mock)
    prisma.ts          # cliente Prisma (singleton)
    auth.ts            # sessão do admin por usuário (cookie HMAC + uid)
    admin-users.ts     # hash scrypt e validação dos usuários admin
    delivery.ts        # motor de distância da entrega (CEP → faixas)
    order-status.ts    # fluxo de produção (transições permitidas)
```

## 📚 Documentação do projeto

Três documentos de controle, mantidos em `docs/`:

- [**Diretrizes**](docs/DIRETRIZES.md) — todas as decisões de projeto (DEC-01…DEC-22)
  com contexto e consequência, e os procedimentos obrigatórios (setup, schema,
  gateway de pagamento, git, verificação, segurança).
- [**Regras de negócio**](docs/REGRAS-DE-NEGOCIO.md) — controle rastreável de cada
  regra (BR-001…BR-032), com a referência no código onde ela vive.
- [**Técnico**](docs/TECNICO.md) — stack, arquitetura, modelo de dados, API,
  ambiente, segurança, achados técnicos (ACH-xxx) e registro de intercorrências.

## 🧠 Fable Method (incorporado)

A pasta `fable-method/` é uma cópia (vendored) do repositório
[Sahir619/fable-method](https://github.com/Sahir619/fable-method) (branch
`main`), o **Fable Workflow**: um loop estruturado de raciocínio
(think/act/prove/grow) para agentes de IA, com avaliação adversarial.

- **Uso:** agentes que trabalham neste projeto devem seguir o `AGENTS.md`
  (método idêntico ao das skills, sem frontmatter específico de Claude).
- **Skills:** `skills/fable-method`, `skills/fable-loop`,
  `skills/fable-judge` e `skills/fable-domain` (com `references/` por domínio).
- **Licença:** MIT (Copyright © 2026 Sahir619) — preservada em `fable-method/LICENSE`.
- **Atualizar:** baixe novamente o tarball da branch `main` do repositório e
  substitua a pasta (mantendo este README e a licença).

## 🎨 Hallmark (incorporado)

A pasta `hallmark/` é uma cópia (vendored) da skill de design do repositório
[Nutlope/hallmark](https://github.com/Nutlope/hallmark) (branch `main`), o
**Hallmark**: uma skill de design "anti-AI-slop" para agentes de código (Claude
Code, Cursor, Codex) com 21 temas, 57 gates de slop-test e quatro verbos
(default / `audit` / `redesign` / `study`).

- **Conteúdo vendored:** apenas a skill em si — `SKILL.md` + `references/`
  (regras, anti-padrões, componentes, macroestruturas, temas, verbos) — e a
  licença. O `site/` e os exemplos do repositório **não** foram incorporados
  (escopo deliberado, ver DEC-17).
- **Uso:** toda solicitação que envolva **design ou layout de view** (criar,
  alterar ou redesenhar página, tela ou componente de UI) **deve** usar a skill
  como ferramenta complementar, carregando `hallmark/SKILL.md` + as
  `references/` cabíveis (diretriz DEC-18 em `docs/DIRETRIZES.md`).
- **Licença:** MIT (Copyright © 2026 Together AI) — preservada em `hallmark/LICENSE`.
- **Atualizar:** rode `node hallmark/update.mjs` (baixa de novo a branch `main`
  e substitui o conteúdo, mantendo a licença) ou siga o procedimento §3.11 em
  `docs/DIRETRIZES.md`.

## 🗒️ Notas

- O `.npmrc` ativa `ignore-scripts` — necessário para instalar em ambientes
  restritos (sandbox). Todos os pacotes usados entregam binários prontos; o
  cliente Prisma é gerado manualmente com `npx prisma generate`.
- Dinheiro é sempre tratado em **centavos** (`priceCents`, `totalCents`) para
  evitar erros de ponto flutuante.
- A autenticação do admin é por **usuários** (e-mail + senha com hash scrypt e
  papéis Admin × Equipe) com cookie assinado (HMAC) de **sessão do navegador** —
  expira ao fechar o navegador, então `/admin` pede login a cada abertura.
  Suficiente para desenvolvimento; troque por Auth.js/SSO em produção (ver DEC-22).

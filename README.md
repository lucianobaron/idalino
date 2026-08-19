# 🥧 Idalino

**Site de vitrine digital para uma fábrica de tortas.** Encomendas online com
pagamento digital (atualmente simulado) e um painel administrativo para
gerenciar a produção dos pedidos.

## ✨ Funcionalidades

- **Vitrine** — catálogo de tortas com categorias, preços e detalhes
- **Carrinho + Checkout** — encomenda com dados de entrega e observações
- **Pagamento mock** — fluxo Pix simulado (pronto para plugar um gateway real)
- **Acompanhamento** — o cliente vê o status do pedido e o histórico
- **Painel admin** — visão geral (contadores) e gestão de produção
  (pago → em produção → pronto → entregue), com anotações e auditoria

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

# 4. Gere o cliente Prisma, crie as tabelas e popule com tortas de exemplo
npx prisma generate
npm run db:migrate
npm run db:seed

# 5. Rode em desenvolvimento
npm run dev
```

Acesse:

- Vitrine: http://localhost:3000
- Painel admin: http://localhost:3000/admin (senha padrão: `idalino-admin`,
  altere `ADMIN_PASSWORD` no `.env`)

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
prisma/
  schema.prisma        # modelos: produtos, clientes, pedidos, produção
  seed.mjs             # tortas de exemplo
src/
  app/
    page.tsx           # vitrine (home)
    tortas/[slug]      # detalhe do produto
    carrinho           # carrinho
    checkout           # formulário de encomenda
    pedido/[id]        # acompanhamento + pagamento mock
    admin/             # painel (login, visão geral, pedidos)
    api/               # orders, products, admin
  components/          # carrinho (context), cards, admin
  lib/
    payments/          # camada de pagamento (interface + mock)
    prisma.ts          # cliente Prisma (singleton)
    auth.ts            # sessão simples do admin (HMAC)
    order-status.ts    # fluxo de produção (transições permitidas)
```

## 🗒️ Notas

- O `.npmrc` ativa `ignore-scripts` — necessário para instalar em ambientes
  restritos (sandbox). Todos os pacotes usados entregam binários prontos; o
  cliente Prisma é gerado manualmente com `npx prisma generate`.
- Dinheiro é sempre tratado em **centavos** (`priceCents`, `totalCents`) para
  evitar erros de ponto flutuante.
- A autenticação do admin é uma senha única com cookie assinado (HMAC) —
  suficiente para desenvolvimento; troque por Auth.js/SSO em produção.

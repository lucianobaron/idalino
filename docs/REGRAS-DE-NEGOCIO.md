# Regras de Negócio — Idalino

> **Escopo deste documento:** controle de **todas as regras de negócio** do sistema
> (encomenda, pagamento, produção, entrega, catálogo, administração). Cada regra tem
> um identificador estável (`BR-xxx`), status e a referência no código onde ela vive.
>
> Documentos irmãos: [`DIRETRIZES.md`](DIRETRIZES.md) (decisões e procedimentos) e
> [`TECNICO.md`](TECNICO.md) (stack, achados e intercorrências).
>
> **Regra de manutenção:** ao alterar o comportamento do sistema, atualize a regra
> correspondente **no mesmo trabalho** (status `alterada` + data + motivo). Ao criar
> comportamento novo, crie `BR-xxx` nova. A fonte da verdade é o código; este arquivo
> é o índice rastreável.

---

## 1. Ciclo de vida do pedido

### BR-001 — Status de um pedido
O pedido tem exatamente um status dentre:
`PENDING_PAYMENT` (aguardando pagamento) → `PAID` (pago) → `IN_PRODUCTION` (em produção) → `READY` (pronto p/ entrega) → `DELIVERED` (entregue) · `CANCELED` (cancelado).
Rótulos e cores de exibição vivem em `src/lib/order-status.ts`.
- **Status:** vigente · **Fonte:** `src/lib/order-status.ts`, `prisma/schema.prisma` (enum `OrderStatus`).

### BR-002 — Transições de status permitidas (matriz única)
A única fonte de verdade para transições válidas é `ORDER_STATUS_TRANSITIONS` em `src/lib/order-status.ts`:

| De | Para (válidos) |
|---|---|
| `PENDING_PAYMENT` | `PAID`, `CANCELED` |
| `PAID` | `IN_PRODUCTION`, `CANCELED` |
| `IN_PRODUCTION` | `READY`, `CANCELED` |
| `READY` | `DELIVERED`, `CANCELED` |
| `DELIVERED` | *(nenhum — terminal)* |
| `CANCELED` | *(nenhum — terminal)* |

A API de admin rejeita qualquer transição fora da matriz (`400` com a lista de
permitidas). A UI (painel) só exibe os botões das transições válidas.
- **Status:** vigente · **Fonte:** `src/lib/order-status.ts`, `src/app/api/admin/orders/[id]/status/route.ts`.
- **Observação:** a rota de admin aceita como destino apenas `PAID`, `IN_PRODUCTION`,
  `READY`, `DELIVERED`, `CANCELED` — não é possível voltar um pedido para
  `PENDING_PAYMENT` pelo painel (nem há transição que o permita).

### BR-003 — Pagamento precisa ser aprovado antes da produção
No fluxo do cliente, um pedido só sai de `PENDING_PAYMENT` para `PAID` quando o
pagamento é aprovado via `POST /api/orders/[id]/pay` (que hoje simula o webhook do
gateway), e **somente** se o pedido ainda estiver em `PENDING_PAYMENT`; caso
contrário a rota responde sem alterar o status.
**Atenção:** o painel admin também oferece a transição `PENDING_PAYMENT → PAID`
(matriz BR-002), permitindo marcar o pedido como pago **manualmente, sem
confirmação do gateway** — comportamento atual do sistema, registrado como achado
técnico (ACH-11 em `TECNICO.md`).
- **Status:** vigente · **Fonte:** `src/app/api/orders/[id]/pay/route.ts`,
  `src/lib/order-status.ts`, `src/components/admin/order-status-control.tsx`.
- **Consequência:** a única garantia de "pagamento antes de produção" vale para o
  fluxo do cliente; o admin tem override manual. Decidir se o override deve ser
  removido ou exigir confirmação explícita quando o gateway real entrar.

### BR-004 — Cancelamento
Um pedido pode ser cancelado a partir de `PENDING_PAYMENT`, `PAID`, `IN_PRODUCTION`
ou `READY` (via painel admin). Pedidos `DELIVERED` e `CANCELED` são terminais: não
podem ser cancelados nem alterados.
- **Status:** vigente · **Fonte:** `src/lib/order-status.ts` (matriz BR-002).

### BR-005 — Nota obrigatória no cancelamento?
Não há regra obrigatória de nota para cancelamento — a nota é opcional (máx. 500
caracteres) em qualquer transição feita pelo admin. Recomenda-se preencher ao
cancelar, mas o sistema não exige.
- **Status:** vigente · **Fonte:** `src/app/api/admin/orders/[id]/status/route.ts` (schema Zod: `note` opcional, `max(500)`).

---

## 2. Preços e valores

### BR-006 — Moeda e unidade: centavos inteiros
Todo valor monetário é inteiro em centavos (`priceCents`, `subtotalCents`,
`deliveryFeeCents`, `totalCents`, `unitPriceCents`). Ex.: R$ 89,90 = `8990`.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma`; decisão `DEC-01` em `DIRETRIZES.md`.

### BR-007 — Preço de venda é definido pelo produto no banco
O valor cobrado por item é `Product.priceCents` vigente **no momento do pedido**,
lido do banco pelo servidor. Preços enviados pelo cliente/carrinho são ignorados no
cálculo (usados apenas para exibição).
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts` (busca produtos e
  recalcula subtotal); decisão `DEC-06`.

### BR-008 — Cliente identificado por e-mail
Cliente é único por `email` (campo `@unique`). Ao criar um pedido, o sistema faz
upsert: se o e-mail já existe, atualiza o nome; se não, cria o cliente. O telefone
informado **não** é atualizado em pedidos subsequentes do mesmo e-mail (fica o do
primeiro cadastro — comportamento atual do código).
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts` (`customer.upsert`),
  `prisma/schema.prisma` (modelo `Customer`).

### BR-009 — Cálculo do total
- `subtotalCents` = Σ (preço do produto no banco × quantidade), por item.
- `totalCents` = `subtotalCents` + `deliveryFeeCents`.
- O cliente pode conferir no checkout (resumo) e na página do pedido; o valor
  oficial é sempre o gravado no pedido pelo servidor.
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts`, exibição em
  `src/app/checkout/page.tsx` e `src/app/pedido/[id]/page.tsx`.

### BR-010 — Taxa de entrega
Taxa única global de entrega, em centavos, definida por `DELIVERY_FEE_CENTS` no
ambiente (default `1500` = R$ 15,00; valor inválido/negativo cai para o default).
Não há taxa por região, peso ou valor mínimo de pedido (hoje).
- **Status:** vigente · **Fonte:** `src/lib/constants.ts`.

---

## 3. Encomenda (checkout)

### BR-011 — Validação dos dados do cliente/entrega
Campos obrigatórios na finalização (validados com Zod no servidor): nome (mín. 2),
e-mail válido, rua (mín. 2), número (mín. 1), bairro (mín. 2), cidade (mín. 2), UF
(exatamente 2 caracteres), CEP (mín. 8). Opcionais: telefone, complemento e
observações. Mensagens de erro em pt-BR.
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts` (schema Zod `orderSchema`).

### BR-012 — Limites de itens
- Carrinho deve ter no mínimo 1 item (pedido sem itens → `400` "Carrinho vazio.").
- Quantidade por item: inteiro, positiva, no máximo 50.
- Quantidade `<= 0` no carrinho remove o item (comportamento do client).
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts` (`cartItemSchema`),
  `src/components/cart/cart-context.tsx`.

### BR-013 — Somente produtos disponíveis podem ser pedidos
Ao criar o pedido, o servidor filtra produtos por `available: true`; qualquer item do
carrinho que não esteja disponível anula o pedido inteiro (`400` "Produto não
disponível no pedido."). Produtos indisponíveis também não aparecem na vitrine nem na
API pública de produtos.
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts`, `src/app/api/products/route.ts`, `src/app/page.tsx`.

### BR-014 — Snapshot dos itens no pedido
Cada item do pedido grava `productName` e `unitPriceCents` copiados do produto no
momento da compra. Alterações futuras do catálogo (nome, preço) **não** afetam
pedidos já criados. O vínculo `productId` é mantido para referência, mas não altera
valores exibidos.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `OrderItem`), criação em `src/app/api/orders/route.ts`.

### BR-015 — Número do pedido (código amigável)
Todo pedido recebe `code` inteiro sequencial único (`autoincrement`), exibido como
`#001`, `#002`... A descrição do pagamento usa esse código (`Pedido #001 — <nome>`).
O `code` não é um número contábil: reinicia após `db:reset`.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `Order.code`),
  `src/app/api/orders/route.ts`, `src/app/pedido/[id]/page.tsx`.

---

## 4. Pagamento

### BR-016 — Meios de pagamento
O pedido registra `paymentMethod` dentre o enum `MOCK | PIX | CARD`. Hoje **todos**
os pedidos são criados com `MOCK` (pagamento simulado); `PIX`/`CARD` existem no
modelo para o futuro.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (enum `PaymentMethod`),
  `src/app/api/orders/route.ts` (`paymentMethod: "MOCK"`).

### BR-017 — Comportamento do pagamento mock
- Ao criar o pedido, o provedor mock gera um pagamento `pending` com **código Pix
  fake** (copia-e-cola) e instruções de que é uma simulação.
- Enquanto o pedido está `PENDING_PAYMENT`, a página do pedido exibe o código Pix e o
  botão **"Simular pagamento aprovado"** — que chama a rota de aprovação (equivale ao
  webhook do gateway real).
- Aprovado → pedido vai a `PAID` com evento "Pagamento aprovado (mock)".
- Nenhuma cobrança real é feita.
- **Status:** vigente · **Fonte:** `src/lib/payments/mock.ts`,
  `src/app/api/orders/[id]/pay/route.ts`, `src/app/pedido/[id]/page.tsx`,
  `src/components/simulate-payment-button.tsx`.

### BR-018 — Registro do pagamento no pedido
Todo pedido guarda `paymentId` (id do pagamento no provedor) e `paymentMethod`.
Sem `paymentId` não há como consultar status no provedor (a rota de pagamento trata
como não aprovado).
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (`Order.paymentId`),
  `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/pay/route.ts`.

---

## 5. Auditoria e acompanhamento

### BR-019 — Trilha de auditoria de produção (eventos)
Toda mudança de status grava um `ProductionEvent`: status de origem (nulo no evento
inicial), status de destino, nota opcional e data. O primeiro evento é criado junto
com o pedido (`PENDING_PAYMENT` — "Pedido criado"). A página de acompanhamento do
cliente e o painel admin exibem essa linha do tempo.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `ProductionEvent`),
  `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/pay/route.ts`,
  `src/app/api/admin/orders/[id]/status/route.ts`, `src/app/pedido/[id]/page.tsx`.

### BR-020 — Acompanhamento pelo cliente
O cliente acompanha o pedido pela URL `/pedido/<id>` (sem login): vê status, itens,
totais, endereço, observações e a linha do tempo. Não há busca por código/número —
o acesso é pelo link/URL gerado no checkout.
- **Status:** vigente · **Fonte:** `src/app/pedido/[id]/page.tsx`.

---

## 6. Administração

### BR-021 — Acesso ao painel exige sessão de admin
O painel (`/admin` e `/admin/pedidos`) exige sessão válida; sem sessão, redireciona
para `/admin/login`. A sessão é emitida com a senha única `ADMIN_PASSWORD` e dura 3
dias (cookie assinado). A API de mudança de status responde `401` sem sessão.
- **Status:** vigente · **Fonte:** `src/lib/auth.ts`, `src/lib/admin-guard.ts`,
  `src/app/api/admin/login/route.ts`, `src/app/api/admin/orders/[id]/status/route.ts`.
- **Atenção:** autenticação é nível dev — ver `DEC-03` e `TECNICO.md` §6.

### BR-022 — Gestão de produção no painel
No painel, o admin vê os pedidos e avança o fluxo de produção (botões apenas com as
transições válidas de BR-002), com anotação opcional (ex.: "pronta às 15h"). Não há
hoje tela de edição de catálogo (produtos/categorias) — o catálogo é administrado
via banco/seed.
- **Status:** vigente · **Fonte:** `src/app/admin/pedidos/page.tsx`,
  `src/components/admin/order-status-control.tsx`.

### BR-023 — Anotações internas de produção
`Order.productionNotes` existe no schema como anotação interna (visível apenas no
admin, por design), mas **ainda não tem interface no painel** — o campo é gravado
somente se preenchido via banco/código. Notas do cliente (`Order.notes`) aparecem
tanto no pedido do cliente quanto no admin.
- **Status:** vigente (campo existente, UI pendente) · **Fonte:** `prisma/schema.prisma` (`Order.notes`, `Order.productionNotes`).

---

## 7. Catálogo

### BR-024 — Visibilidade de produto
Produto visível na vitrine e na API pública somente com `available: true` (default
`true`). Categoria é opcional (`categoryId` nulo). Enquanto não há fotos reais, a
arte de exibição é um `emoji` (default `🍰`; `imageUrl` opcional).
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `Product`),
  `src/app/page.tsx`, `src/app/api/products/route.ts`.

### BR-025 — Seed de demonstração
O seed cria/atualiza (upsert por slug) 3 categorias — Clássicas, Frutas, Especiais —
e 6 tortas de exemplo. Re-executável sem duplicar (idempotente).
- **Status:** vigente · **Fonte:** `prisma/seed.mjs`.

### BR-026 — Promessas de comunicação (copy) não validadas pelo sistema
A página de detalhe do produto exibe "Informações importantes" com promessas
comerciais — pedidos até 18h entregues no dia seguinte, entrega na cidade e região,
atualizações por e-mail, Pix ou cartão. **Essas afirmações são texto estático de
marketing: o sistema não valida horário de corte, região de entrega nem envia
e-mails.** Antes de produção, decidir quais promessas viram regra real (agendamento,
região, notificações) ou ajustar o copy.
- **Status:** vigente (copy) · **Fonte:** `src/app/tortas/[slug]/page.tsx`.

---

## 8. Controle de mudanças das regras

| Regra | Data | Mudança | Motivo |
|---|---|---|---|
| — | 2026-08-19 | Criação do documento (BR-001 a BR-026) | Documentação inicial do projeto |

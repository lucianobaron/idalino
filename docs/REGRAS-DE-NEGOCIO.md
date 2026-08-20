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
- `deliveryFeeCents` = preço da faixa de distância (BR-010) quando a entrega é
  escolhida, ou `0` quando a retirada na loja é escolhida (BR-028).
- O cliente pode conferir no checkout (resumo) e na página do pedido; o valor
  oficial é sempre o gravado no pedido pelo servidor.
- **Status:** vigente · **Fonte:** `src/app/api/orders/route.ts`, exibição em
  `src/app/checkout/page.tsx` e `src/app/pedido/[id]/page.tsx`.

### BR-010 — Taxa de entrega por faixas de distância
A taxa de entrega **não é mais uma constante global**: o preço é definido por
**faixas de distância** (`DeliveryFeeRange`), configuradas no painel admin em
`/admin/entregas`. Cada faixa tem `minKm` (inclusivo), `maxKm` (exclusivo;
**nulo = faixa aberta**, vale para toda distância a partir de `minKm`) e
`priceCents` (inteiro em centavos, DEC-01). Regras de validação:
- No máximo **uma** faixa aberta, e ela deve ser a última (maior `minKm`).
- Faixas não podem se sobrepor (distâncias iguais a um limite entram na faixa
  seguinte: `min <= d < max`).
- Sem faixa que cubra a distância (incluindo buracos entre faixas), a entrega
  **não é oferecida** para aquele CEP (BR-029).
- **Status:** vigente (substitui a antiga taxa única `DELIVERY_FEE_CENTS`) ·
  **Fonte:** `prisma/schema.prisma` (modelo `DeliveryFeeRange`),
  `src/lib/delivery-fees-admin.ts`, `src/app/api/admin/delivery-fees/route.ts`,
  `src/lib/delivery.ts`.

---

## 3. Encomenda (checkout)

### BR-011 — Validação dos dados do cliente/entrega
Campos obrigatórios na finalização (validados com Zod no servidor): nome (mín. 2),
e-mail válido. O **endereço de entrega** (rua mín. 2, número mín. 1, bairro mín. 2,
cidade mín. 2, UF exatamente 2, CEP mín. 8) é obrigatório **somente quando a
entrega é escolhida** (BR-028); na retirada na loja o endereço é ignorado e
gravado como nulo. Opcionais: telefone, complemento e observações. Mensagens de
erro em pt-BR.
- **Status:** vigente (ajustada para retirada × entrega) · **Fonte:**
  `src/app/api/orders/route.ts` (schema Zod `orderSchema` + `superRefine`).

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

### BR-028 — Escolha no checkout: retirada na loja × entrega
No checkout, o cliente escolhe entre **retirar na loja** (`PICKUP`) e **entrega**
(`DELIVERY`, default). O pedido grava `Order.deliveryType`:
- **PICKUP:** sem taxa de entrega (`deliveryFeeCents = 0`), endereço de entrega
  não é exigido (gravado nulo) e a página do pedido exibe "Retirada na loja" com
  o endereço da loja (ponto de saída, BR-030), quando preenchido.
- **DELIVERY:** endereço obrigatório (BR-011), taxa calculada pela faixa de
  distância (BR-010) e distância gravada como snapshot (`deliveryDistanceKm`).
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (enum `DeliveryType`),
  `src/app/api/orders/route.ts`, `src/app/checkout/page.tsx`,
  `src/app/pedido/[id]/page.tsx`, `src/app/admin/(painel)/pedidos/page.tsx`.

### BR-029 — Cobertura da entrega (fora da faixa)
A entrega só é oferecida para CEPs cuja distância até a loja se encaixe em alguma
faixa cadastrada. Distâncias fora de toda faixa (abaixo da primeira, em buracos
entre faixas ou além da última — salvo faixa aberta) são recusadas no checkout e
na criação do pedido com a mensagem "Não realizamos entrega para este CEP." A
retirada na loja continua disponível em qualquer caso. A prévia no checkout usa a
rota `GET /api/delivery/quote?cep=...`; o valor oficial é sempre recalculado no
servidor ao criar o pedido (DEC-06).
- **Status:** vigente · **Fonte:** `src/lib/delivery.ts` (`quoteDelivery`),
  `src/app/api/orders/route.ts`, `src/app/api/delivery/quote/route.ts`.

### BR-030 — Ponto de saída da loja (origem do cálculo)
O ponto de saída da loja é configurável no painel (`/admin/entregas` →
"Ponto de saída da loja"): o CEP da loja é obrigatório (origem do cálculo de
distância, coordenadas resolvidas no salvamento) e o endereço completo é opcional
(exibição na retirada). Enquanto o CEP não for configurado, a entrega fica
indisponível ("Entrega indisponível no momento.") e a retirada segue funcionando.
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `StoreSettings`,
  linha única `id = "store"`), `src/app/api/admin/delivery/settings/route.ts`,
  `src/components/admin/store-settings-form.tsx`.

### BR-031 — Distância calculada pelo CEP (snapshot no pedido)
A distância é calculada no servidor entre as coordenadas do CEP da loja
(StoreSettings) e as coordenadas do CEP de entrega (serviços gratuitos:
AwesomeAPI CEP, com fallback Nominatim/OSM), em linha reta (haversine), e o
resultado é gravado no pedido (`deliveryDistanceKm`) junto com a taxa cobrada
(`deliveryFeeCents`) — alterações futuras de faixas ou do CEP da loja **não**
afetam pedidos já criados (mesma filosofia do snapshot de itens, DEC-08). A
distância é aproximada (linha reta × CEP, não rota real); o motor é isolado em
`src/lib/delivery.ts` para trocar por um provedor preciso (ex.: Google Maps) em
produção — ver decisão DEC-21. **CEPs que os serviços gratuitos não conseguem
resolver são recusados como "CEP inválido"** (não é possível calcular a
distância; ex.: 04000000 — ver INC-01 em `TECNICO.md`).
- **Status:** vigente · **Fonte:** `src/lib/delivery.ts`, `prisma/schema.prisma`
  (modelo `Order.deliveryDistanceKm`), `src/app/api/orders/route.ts`.

### BR-033 — Carrinho é esvaziado ao concluir o pedido
Ao concluir a encomenda (clique em **"Confirmar encomenda"** no checkout), com o
pedido criado com sucesso (201 da API), o carrinho é **limpo no cliente**
(`clear()`): a badge volta a 0, a página do carrinho fica vazia e os cards da
vitrine voltam ao botão **"Adicionar"** (steppers de quantidade liberados —
DEC-24). Se a criação falhar (validação, entrega indisponível, etc.), o carrinho
é **preservado** para nova tentativa.
- **Status:** vigente · **Fonte:** `src/app/checkout/page.tsx` (`handleSubmit` →
  `clear()` + redirect para `/pedido/<id>`), `src/components/cart/cart-context.tsx`
  (`clear`), `src/app/api/orders/route.ts` (resposta `201 { orderId }`).

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
O painel (`/admin` e telas de gestão) exige sessão válida; sem sessão, redireciona
para `/admin/login`. O login é feito com **e-mail + senha de um usuário admin**
(BR-032); a sessão é um cookie assinado por HMAC **de sessão do navegador** —
morre ao fechar o navegador, então o painel volta a pedir login a cada abertura
(teto de 3 dias apenas no `exp` do token, limite máximo no servidor) — vinculado
ao usuário logado. A API responde `401` sem sessão.
- **Status:** vigente · **Fonte:** `src/lib/auth.ts`, `src/lib/admin-guard.ts`,
  `src/app/api/admin/login/route.ts`, `src/app/api/admin/session/route.ts`,
  `src/app/admin/(painel)/layout.tsx` (portão central: exige sessão para toda
  rota sob `/admin`, exceto `/admin/login`).
- **Atenção:** autenticação é nível dev — ver `DEC-03`/`DEC-22` e `TECNICO.md` §7.

### BR-032 — Usuários admin e papéis (Admin × Equipe)
Usuários com acesso ao painel vivem no modelo `AdminUser` (nome, e-mail único,
senha **armazenada apenas como hash scrypt** — nunca texto puro) e têm um
**papel**:
- **Admin** (`ADMIN`): acesso total — visão geral, pedidos, tortas, entregas e
  usuários.
- **Equipe** (`TEAM`): **só visão geral e pedidos** (pode avançar o status de
  produção). Não acessa tortas, entregas nem usuários — as rotas e telas dessas
  áreas respondem `403`/redirecionam.

A tela `/admin/usuarios` (acessível só a Admin) permite criar, editar
(nome/e-mail/senha/papel; senha em branco na edição mantém a atual) e excluir
usuários. Proteções:
- Não é possível excluir o **próprio usuário** logado.
- Não é possível excluir o **último** usuário admin.
- Ninguém altera o **próprio papel**; o painel nunca fica sem ao menos um
  `ADMIN` (não é possível rebaixar o último Admin).
- Novo usuário nasce como `TEAM` por padrão (menor privilégio); e-mail duplicado
  é rejeitado (`400`).
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `AdminUser`,
  enum `AdminRole`), `src/lib/admin-users.ts`, `src/lib/auth.ts`
  (`checkAdminRole`), `src/lib/admin-guard.ts` (`requireAdminRole`),
  `src/app/api/admin/users/`, `src/app/admin/(painel)/usuarios/`.

### BR-022 — Gestão de produção no painel
No painel, **Admin e Equipe** (BR-032) veem os pedidos e avançam o fluxo de
produção (botões apenas com as transições válidas de BR-002), com anotação
opcional (ex.: "pronta às 15h"). As tortas são geridas na tela **Tortas**
(BR-027, só Admin); categorias seguem administradas via banco/seed (não há tela
de categorias).
- **Status:** vigente · **Fonte:** `src/app/admin/(painel)/pedidos/page.tsx`,
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
`true`). Categoria é opcional (`categoryId` nulo). A arte de exibição de cada torta
é definida por `imageUrl` (preenchida na edição da torta); sem foto real, o
fallback é o `emoji` (default `🍰`).
- **Status:** vigente · **Fonte:** `prisma/schema.prisma` (modelo `Product`),
  `src/app/page.tsx`, `src/app/api/products/route.ts`.
- **Observação:** a distribuição automática de fotos ilustrativas na vitrine é um
  **procedimento temporário de popularização** (ver `TECNICO.md` §2 e
  `DIRETRIZES.md` §3.7) — não é regra de negócio; o fluxo regular é a edição de
  cada torta.

### BR-025 — Seed de demonstração
O seed cria/atualiza (upsert por slug) 3 categorias — Clássicas, Frutas, Especiais —
e 6 tortas de exemplo, com `weightGrams` (peso em gramas). Re-executável sem
duplicar (idempotente).
- **Status:** vigente · **Fonte:** `prisma/seed.mjs`.

### BR-026 — Promessas de comunicação (copy) não validadas pelo sistema
A página de detalhe do produto exibe "Informações importantes" com promessas
comerciais — pedidos até 18h entregues no dia seguinte, entrega na cidade e região,
atualizações por e-mail, Pix ou cartão. **Essas afirmações são texto estático de
marketing: o sistema não valida horário de corte, região de entrega nem envia
e-mails.** Antes de produção, decidir quais promessas viram regra real (agendamento,
região, notificações) ou ajustar o copy.
- **Status:** vigente (copy) · **Fonte:** `src/app/tortas/[slug]/page.tsx`.

### BR-027 — Gestão de tortas no painel
O painel tem a tela **Tortas** (`/admin/tortas`): lista todas as tortas (disponíveis
e indisponíveis) e permite criar, editar e excluir. Campos: nome, peso em gramas
(obrigatório no formulário), descrição, preço (inteiro em centavos, DEC-01), imagem
(upload de arquivo no painel — JPG/PNG/WebP até 5 MB — ou URL) e disponibilidade
(`available`). O `slug` é gerado
automaticamente a partir do nome (único; sufixo `-2`, `-3`… em conflito) e
regenerado quando o nome muda. Excluir uma torta não altera pedidos antigos: os
itens do pedido guardam snapshot de nome/preço (DEC-08).
- **Status:** vigente · **Fonte:** `src/app/admin/(painel)/tortas/`,
  `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`,
  `src/lib/products-admin.ts`.

---

## 8. Controle de mudanças das regras

| Regra | Data | Mudança | Motivo |
|---|---|---|---|
| — | 2026-08-19 | Criação do documento (BR-001 a BR-026) | Documentação inicial do projeto |
| BR-024 | 2026-08-19 | Texto revertido ao original + observação: distribuição automática de fotos ilustrativas é **procedimento temporário de popularização**, não regra de negócio | Alinhamento com o dono do projeto: fluxo regular é a edição de cada torta (`imageUrl`) |
| BR-022 | 2026-08-20 | Texto ajustado: gestão de tortas agora tem tela no painel (BR-027); categorias seguem via banco/seed | CRUD de tortas implementado |
| BR-025 | 2026-08-20 | Seed passou a incluir `weightGrams` (peso em gramas) | Campo peso criado para o CRUD |
| BR-027 | 2026-08-20 | Nova regra: gestão de tortas no painel (criar/editar/excluir; slug automático; imagem por URL) | CRUD de tortas implementado |
| BR-027 | 2026-08-20 | Texto atualizado: imagem agora suporta upload de arquivo no painel (não só URL) | Upload de imagem implementado |
| BR-010 | 2026-08-20 | Taxa única global substituída por **faixas de distância** (`DeliveryFeeRange`, com faixa aberta opcional e validação de sobreposição) | CRUD de preço de entrega implementado (pedido do dono) |
| BR-011 | 2026-08-20 | Endereço de entrega passou a ser obrigatório **apenas** quando a entrega é escolhida (retirada na loja não exige) | Escolha retirada × entrega implementada |
| BR-028 | 2026-08-20 | Nova regra: escolha no checkout entre retirar na loja e entrega (`Order.deliveryType`) | Pedido do dono |
| BR-029 | 2026-08-20 | Nova regra: cobertura da entrega — distância fora de toda faixa recusa a entrega (faixa aberta opcional) | Pedido do dono |
| BR-030 | 2026-08-20 | Nova regra: ponto de saída da loja configurável no painel (CEP obrigatório; endereço opcional p/ exibição) | Pedido do dono |
| BR-031 | 2026-08-20 | Nova regra: distância calculada pelo CEP (haversine) com snapshot `deliveryDistanceKm` no pedido | Pedido do dono |
| BR-021 | 2026-08-20 | Login deixou de ser senha única: passou a exigir **e-mail + senha de usuário admin** (sessão HMAC vinculada ao usuário) | Sistema de usuários admin implementado (decisão do dono) |
| BR-032 | 2026-08-20 | Nova regra: gestão de usuários admin (criar/editar/excluir; senha com hash scrypt; não exclui a si mesmo nem o último admin) | Sistema de usuários admin implementado |
| BR-032 | 2026-08-20 | Adicionados **papéis** Admin × Equipe: Equipe só vê visão geral e pedidos; guardas por papel nas rotas/telas; novo usuário nasce Equipe; ninguém altera o próprio papel nem deixa o painel sem Admin | Papel abaixo de admin implementado (pedido do dono) |
| BR-022 | 2026-08-20 | Texto ajustado: gestão de pedidos agora é de **Admin e Equipe** (BR-032); tortas seguem só do Admin | Papéis implementados |
| BR-031 | 2026-08-20 | Texto atualizado: CEPs irresolvíveis pelos serviços gratuitos são recusados como "CEP inválido" (INC-01) | Revisão das sessões do dia |
| BR-033 | 2026-08-20 | Nova regra: carrinho é esvaziado ao concluir o pedido (`clear()` no checkout após 201; cards voltam a "Adicionar") | Avaliação do fluxo pós-compra (pedido do dono) |
| BR-021 | 2026-08-20 | Texto atualizado: exigência de sessão passou a ser garantida **por construção** — portão central `src/app/admin/(painel)/layout.tsx` (todas as páginas admin no route group; `/admin/login` fora) | Relato de área admin acessível sem login (ver ACH-21 em `TECNICO.md`) |
| BR-021 | 2026-08-20 | Sessão alterada para **cookie de sessão do navegador** (sem `maxAge`): morre ao fechar o navegador e o painel pede login a cada abertura; `exp` do token (3 dias) vira teto máximo no servidor | Decisão do dono: "sempre pedir login ao reabrir o navegador" |

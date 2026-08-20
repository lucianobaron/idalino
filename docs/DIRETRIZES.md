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
  `totalCents`, `unitPriceCents`, `amountCents`, `DELIVERY_FEE_CENTS`). A conversão para
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
- **Status:** aceita (com restrição explícita de uso)
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
- **Arte:** enquanto não há fotos reais, produtos usam `emoji` (default `🍰`).
- **Fronteira server/client:** páginas que leem banco são Server Components
  `force-dynamic`; só superfícies interativas são client components (DEC-05).
- **Validação:** Zod no servidor para toda entrada (formulários e API); mensagens de
  erro amigáveis em pt-BR (`z.string().min(2, "Informe seu nome.")` etc.).
- **Organização:** rotas em `src/app/<rota>`, componentes reutilizáveis em
  `src/components/`, lógica em `src/lib/` (domínio em `src/lib/payments/`).

### 3.8 Segurança (checklist antes de produção)
- [ ] `ADMIN_PASSWORD` forte (não `idalino-admin`) e `ADMIN_SECRET` aleatório longo.
- [ ] `COOKIE_SECURE=true` (site em HTTPS).
- [ ] Remover o hint de senha padrão do formulário de login
      (`src/components/admin/login-form.tsx`).
- [ ] Trocar auth do admin por Auth.js/SSO (DEC-03) e adicionar rate-limit no login.
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
`.claude/skills/i-have-adhd/SKILL.md`: (1) confirmação do que foi compreendido,
(2) resumo numerado das etapas, (3) conclusão com o que ficou pronto e uma única
próxima ação. A estrutura prevalece sobre recapitulações vazias; as demais regras
da skill (liderar com a próxima ação, listas com no máximo 5 itens, sem
preâmbulo ou encerramento vazios, estimativas de tempo concretas) valem em toda
resposta, até o dono do projeto dizer "stop adhd mode".

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

# Idalino — Instruções para agentes de IA

Leia estes documentos **no início de toda sessão, antes de qualquer trabalho**,
nesta ordem:

1. `docs/DIRETRIZES.md` — fonte da verdade do projeto: decisões (DEC-01…DEC-22)
   e procedimentos obrigatórios (§3.1–§3.12). Quando conflitar com qualquer
   outra referência, este arquivo manda — exceto instrução direta do usuário.
2. `fable-method/AGENTS.md` — método de raciocínio obrigatório (loop
   fable-method, DEC-15): classificar o pedido, definir "done", reunir
   evidências, agir cirurgicamente, verificar por observação, reportar
   resultado primeiro.
3. `hallmark/SKILL.md` (+ as `references/` cabíveis) — regras de design
   anti-AI-slop (DEC-17/18); obrigatório em toda solicitação que envolva design
   ou layout de views.
4. `.claude/skills/i-have-adhd/SKILL.md` — formato de interação obrigatório com
   o dono do projeto (§3.9): confirmação do que foi compreendido → resumo
   numerado das etapas → conclusão com próxima ação; vale em toda resposta até
   o dono dizer "stop adhd mode".

Regras universais (valem antes mesmo de ler as diretrizes):

- Nunca commitar nem pushar sem instrução explícita do usuário.
- UI, mensagens e documentação em pt-BR.
- Não adicionar dependências sem necessidade e sem avisar.
- Não enfraquecer checks nem fabricar o que eles procuram.
- **Antes de declarar qualquer tarefa concluída, fazer a conferência obrigatória
  de documentação (§3.12 do DIRETRIZES):** (1) existe informação que deve ser
  registrada? (achado/intercorrência → TECNICO.md; regra de negócio →
  REGRAS-DE-NEGOCIO.md; decisão/procedimento → DIRETRIZES.md); (2) a
  documentação do projeto foi atualizada? Sem os registros devidos, a tarefa
  **não está concluída**.

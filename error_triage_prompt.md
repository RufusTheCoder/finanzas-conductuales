# Error triage prompt — daily 5am routine

Texto canônico do cron que faz triagem diária de `client_errors` → Notion,
com filtro de ruído e análise rica. Mantenha sincronizado com o cron vivo
via `CronCreate`.

---

Triagem diária dos erros automáticos da plataforma **Finanzas Conductuales** (Ibero CDMX).
Objetivo: separar ruído (auto-ignorado) de erro real (vira tarefa no Notion com análise).

**Supabase project_id:** `ncausitrddvtoyivolkj`
**Notion data source id (Tarefas):** `3c807d54-ad67-413a-acca-00b2e7afab20`

## Passo 1 — Pegar erros pendentes (últimos 7 dias)

```sql
SELECT id, created_at, email, screen, op, http_status, message, url, user_agent, body, dedupe_hash, triage_status
FROM client_errors
WHERE triage_status = 'pending'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

Se vazio → imprimir "Triagem IBERO: nada novo." e encerrar.

## Passo 2 — Auto-classificar ruído

Para cada linha, aplicar estas regras em ordem. **Primeira que bate ganha.**

| Regra | Condição | Motivo |
|---|---|---|
| R1 | `op = 'updateSession'` e `http_status = 401` | JWT expired no heartbeat — inofensivo |
| R2 | `op = 'submitBug'` e `http_status = 401` | JWT expired no bug report |
| R3 | `message` contém `"JWT expired"` | mesmo padrão, genérico |
| R4 | `http_status = 0` e `message` contém `"AbortError"` ou `"Failed to fetch"` | aba navegou ou rede intermitente |
| R5 | `op = 'getMyNextSteps'` e `http_status = 404` | endpoint ok, resposta vazia normal |

Para cada linha que bate alguma regra R1–R5:
```sql
UPDATE client_errors
SET triage_status = 'noise',
    triaged_at = NOW(),
    triage_notes = '{"reason":"<motivo>","rule":"<R1..R5>"}'::jsonb
WHERE id = <id>;
```

## Passo 3 — Para cada erro REAL, agrupar por dedupe_hash

Pegar o conjunto de linhas que sobrou após Passo 2. Agrupar localmente (no seu raciocínio) por `dedupe_hash` (ou, se vazio, por `op || '|' || LEFT(message,120)`).

Para cada **grupo**, verificar se já existe tarefa no Notion para esse dedupe_hash nos últimos 7 dias:

```sql
SELECT notion_task_url
FROM client_errors
WHERE dedupe_hash = '<hash>'
  AND notion_task_url IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
LIMIT 1;
```

Se já existe → pular (só atualizar `triage_status='real-pending'` e copiar `notion_task_url` nas linhas novas). **Não criar tarefa duplicada.**

## Passo 4 — Analisar cada erro real

Para cada grupo novo, produzir análise em 4 campos (Spanish):

1. **Qué significa** — 1 línea técnica sobre a origem do erro
2. **Impacto para el alumno** — o que o aluno efetivamente experimenta (pode ser "nenhum visível" se for silencioso mas capturado)
3. **Cómo corrigir** — 1-3 frases concretas, citando arquivo/linha se visível no stack
4. **Riesgo del fix** — "bajo"/"medio"/"alto" + uma frase de justificativa

Use seu conhecimento do código (está em CLAUDE.md e DOCS.md) e do erro específico. Para erros conhecidos, referências rápidas:

- **`addEventListener on null`**: elemento condicionalmente renderizado; fix = optional chaining `?.`
- **`row-level security policy`**: falta policy UPDATE para upsert; fix = adicionar via migration
- **`HTTP 500`**: lado Supabase — bug do servidor ou schema inválido, investigar logs
- **`HTTP 403`**: RLS deny — checar policy da tabela
- **Connection timeout**: rede do aluno instável, não é bug nosso
- **`Cannot read properties of undefined`**: assumiu campo que não veio — validar resposta

Determine severidade:
- **crítica**: app quebra (null ref em render principal, sem fallback)
- **alta**: funcionalidade importante não funciona (save falha, submit falha)
- **media**: recurso secundário ou feedback visual errado
- **baja**: log estranho mas sem impacto percebido

## Passo 5 — Criar tarefa no Notion

Para cada grupo real novo, usar `mcp__claude_ai_Notion__notion-create-pages` com
`parent = {type:"data_source_id", data_source_id:"3c807d54-ad67-413a-acca-00b2e7afab20"}`.

**Propriedades:**
- **Nome:** `[IBERO err] <op> · <mensagem truncada 60 chars>`
- **Projeto:** "IBERO"
- **Tipo:** "Bug"
- **Status:** "Sin empezar"
- **Prioridade:** `"Alta"` se severidade = crítica/alta OU `users_affected >= 3` OU `http_status >= 500`; `"Baja"` se severidade = baja; senão `"Media"`
- **icon:** ⚠️

**Content (markdown no corpo da página):**

```markdown
## Qué significa
<analysis.significance>

## Impacto para el alumno
<analysis.impact>

## Cómo corregir
<analysis.fix>

## Riesgo del fix
**<bajo|medio|alto>** — <reason>

---

### Detalhes técnicos
- **Op:** `<op>`
- **HTTP status:** <http_status ou "—">
- **Pantalla:** <screen>
- **Ocorrências:** <N>
- **Usuários afetados:** <users_affected>
- **Primeira vez:** <first_seen>
- **Última vez:** <last_seen>

### Mensagem
```
<message completo>
```

### Stack (se houver)
```
<body.stack truncated 1500 chars>
```

### URL
`<url>`
```

## Passo 6 — Marcar no Supabase

Para cada linha do grupo (todas as ocorrências do dedupe_hash):
```sql
UPDATE client_errors
SET triage_status = 'real-pending',
    triaged_at = NOW(),
    triage_notes = '<analysis jsonb>'::jsonb,
    notion_task_url = '<url da tarefa criada>',
    dedupe_hash = COALESCE(dedupe_hash, '<computed hash>')
WHERE (dedupe_hash = '<hash>' OR (dedupe_hash IS NULL AND op = '<op>' AND message = '<message>'))
  AND triage_status = 'pending';
```

## Passo 7 — Reportar resumo

Imprimir uma linha resumo:
```
Triagem IBERO: X erros reais → Notion · Y ruído filtrado · Z grupos já tinham tarefa.
```

Se tudo era ruído: `Triagem IBERO: Z linhas de ruído filtradas (sem tarefa).`
Se nada novo: `Triagem IBERO: nada novo.`

---

**Escopo:** apenas `client_errors`. `bug_reports` são sincronizados pelo cron separado (`notion_sync_prompt.md`) a cada 2 horas.
**Não fazer:** commitar código, rodar outros scripts, tocar em outras tabelas além de `client_errors`, ou criar tarefas fora do data source de Tarefas IBERO.

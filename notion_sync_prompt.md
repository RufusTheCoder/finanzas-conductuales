# Notion sync prompt — canonical text

This is the exact prompt passed to `CronCreate` to run the bugs/errors → Notion sync. Keep this file in sync with the live cron. See `CLAUDE.md` → "Notion sync" section.

---

Sync de bugs e erros da plataforma finanzas-conductuales (Supabase) para a database Tarefas no Notion.

**Projeto:** finanzas-conductuales (Ibero CDMX)
**Supabase project_id:** ncausitrddvtoyivolkj
**Notion data source id:** 3c807d54-ad67-413a-acca-00b2e7afab20

## Passo 1 — Buscar bug_reports não sincronizados
Executar via mcp__claude_ai_Supabase__execute_sql:
```sql
SELECT id, created_at, email, screen, title, description
FROM bug_reports
WHERE notion_task_url IS NULL
ORDER BY created_at ASC;
```

## Passo 2 — Buscar client_errors não sincronizados (agrupados por dedupe_hash)
```sql
WITH grouped AS (
  SELECT
    COALESCE(op,'?') || '|' || LEFT(COALESCE(message,''), 120) AS dh,
    COUNT(*) AS n,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen,
    MAX(op) AS op,
    MAX(message) AS message,
    MAX(http_status::text) AS http_status,
    MAX(screen) AS screen,
    COUNT(DISTINCT email) AS users_affected
  FROM client_errors
  WHERE notion_task_url IS NULL
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY dh
)
SELECT * FROM grouped
WHERE dh NOT IN (
  SELECT DISTINCT dedupe_hash FROM client_errors
  WHERE notion_task_url IS NOT NULL
    AND created_at > NOW() - INTERVAL '7 days'
    AND dedupe_hash IS NOT NULL
)
ORDER BY last_seen DESC
LIMIT 20;
```

## Passo 3 — Para cada linha, criar tarefa no Notion
Usar mcp__claude_ai_Notion__notion-create-pages com
`parent = {type:"data_source_id", data_source_id:"3c807d54-ad67-413a-acca-00b2e7afab20"}`.

**Para bug_report:**
- Nome: `[IBERO bug] <title>`
- Projeto: "IBERO", Tipo: "Bug", Prioridade: "Média", Status: "Sin empezar"
- icon: 🐛
- Contexto: email, screen, data, título, descrição
- content: markdown com origem (bug_reports), descrição completa

**Para client_error (grupo):**
- Nome: `[IBERO err] <op> · <http_status>`
- Projeto: "IBERO", Tipo: "Bug", Status: "Sin empezar"
- Prioridade: "Alta" se `users_affected >= 3` OU `http_status >= 500`; senão "Média"
- icon: ⚠️
- Contexto: op, mensagem, n ocorrências, users_affected, first_seen, last_seen
- content: markdown com detalhes

## Passo 4 — Marcar como sincronizado no Supabase
Para bug_reports:
```sql
UPDATE bug_reports SET notion_task_url = '<url>' WHERE id = '<id>';
```

Para client_errors (marcar todas as linhas do grupo):
```sql
UPDATE client_errors
SET notion_task_url = '<url>', dedupe_hash = '<dh>'
WHERE notion_task_url IS NULL
  AND COALESCE(op,'?') || '|' || LEFT(COALESCE(message,''), 120) = '<dh>';
```

## Passo 5 — Reportar resumo
Imprimir: "Sync IBERO: X bug_reports + Y grupos de client_errors criados como tarefas Notion."
Se não houver nada novo: "Sync IBERO: nada novo." e encerrar silenciosamente.

Não fazer nada fora deste scope. Não tocar em outros projetos. Não commitar código. Apenas ler Supabase, criar tarefas Notion, e atualizar notion_task_url.

# Notion sync prompt — bug_reports (canonical)

Texto canônico do cron que sincroniza `bug_reports` → tarefas Notion a cada 2h.
Mantenha sincronizado com o cron vivo. Veja `CLAUDE.md` → seção Notion sync.

`client_errors` **não entram aqui** — são tratados pela rotina diária
`error_triage_prompt.md` (cron 5am com filtro de ruído + análise).

---

Sync de bug reports da plataforma **Finanzas Conductuales** (Ibero CDMX) para a database Tarefas no Notion.

**Supabase project_id:** `ncausitrddvtoyivolkj`
**Notion data source id:** `3c807d54-ad67-413a-acca-00b2e7afab20`

## Passo 1 — Buscar bug_reports não sincronizados

```sql
SELECT id, created_at, email, screen, title, description
FROM bug_reports
WHERE notion_task_url IS NULL
ORDER BY created_at ASC;
```

## Passo 2 — Para cada bug_report, criar tarefa no Notion

Usar `mcp__claude_ai_Notion__notion-create-pages` com
`parent = {type:"data_source_id", data_source_id:"3c807d54-ad67-413a-acca-00b2e7afab20"}`.

- **Nome:** `[IBERO bug] <title>`
- **Projeto:** "IBERO"
- **Tipo:** "Bug"
- **Prioridade:** "Média"
- **Status:** "Sin empezar"
- **icon:** 🐛

**Content (markdown):**
```markdown
**Origem:** bug_reports (reportado pelo aluno via FAB)

- **Email:** <email>
- **Pantalla:** <screen>
- **Data:** <created_at>

### Título
<title>

### Descrição
<description or "(sin descripción)">
```

## Passo 3 — Marcar como sincronizado

```sql
UPDATE bug_reports SET notion_task_url = '<url>' WHERE id = '<id>';
```

## Passo 4 — Reportar resumo

Imprimir: `Sync IBERO bugs: X tarefas criadas.`
Se nada novo: `Sync IBERO bugs: nada novo.`

---

**Escopo:** apenas `bug_reports`. Não tocar em `client_errors` (rotina separada).
Não commitar código, não mexer em outros projetos.

# Finanzas Conductuales — Documentação técnica

> Plataforma educacional de finanças comportamentais para alunos da
> Universidad Iberoamericana CDMX. Curso do Rodrigo Marques.
>
> - App: https://finanzas-conductuales.netlify.app
> - Admin: https://finanzas-conductuales.netlify.app/admin.html
> - Supabase: `ncausitrddvtoyivolkj.supabase.co`
> - Repo: https://github.com/RufusTheCoder/finanzas-conductuales

Este é o ponto de entrada. Para contexto mais antigo ou detalhes pontuais,
ver: [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md), [CHANGELOG.md](CHANGELOG.md).

---

## 1. Visão geral

- **Stack:** HTML + CSS + JS puro (ES modules), sem build, sem framework.
- **Backend:** Supabase (Postgres + REST + Auth) acessado via `fetch`,
  **sem** o SDK oficial.
- **Deploy:** push para `master` → Netlify auto-deploya de `public/`.
- **Sem package.json no raiz** — o projeto é servido como arquivos
  estáticos; Node só é usado para scripts auxiliares (backup).

## 2. Estrutura de pastas

```
finanzas-conductuales/
├── public/
│   ├── index.html              shell da app
│   ├── admin.html              backoffice
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js           SUPABASE_URL + anon key
│   │   ├── supabase.js         wrapper REST (fetch) para auth + data
│   │   ├── app.js              UI, state machine, render()
│   │   └── admin.js            backoffice: leitura + flags + backups
│   └── data/
│       ├── questions.js        BIT (20 perguntas)
│       ├── sesgos.js           15 módulos de sesgos
│       └── profiles.js         definição dos 4 perfis BIT
├── scripts/
│   └── backup.mjs              dump incremental (ver §7)
├── .github/workflows/
│   └── backup.yml              cron semanal (ver §7)
├── SUPABASE_SCHEMA.sql         DDL canônico
├── netlify.toml
└── DOCS.md                     este arquivo
```

## 3. Rodar local

```bash
# opção A
npx serve public

# opção B
python -m http.server 8080 --directory public

# opção C: abrir public/index.html direto no browser
```

Sem build, sem install. Só garantir que `public/js/config.js` tenha
a `SUPABASE_ANON_KEY` correta (ver `.env.example`).

## 4. Estado da aplicação

Tudo gira em torno de um objeto `state` em `app.js` e uma função
`render()` que substitui `#app.innerHTML`. Telas:
`auth → dashboard → bit → sesgo(s) → report → next-steps`.

### Convenções críticas

- **Perfis BIT:** `PP`, `FK`, `II`, `AA`. `FK` é a chave interna
  para "Friendly Follower" (exibido como "FF" via `bitLabel()`).
  **Nunca renomear `FK`** — está salvo no Supabase e quebra usuários
  existentes.
- **`devSkip()` / `devFillAll()`** são helpers de dev; não podem
  aparecer em produção.
- **`service_role` key** nunca entra no frontend. Só `anon_key` em
  `config.js`.
- **Nomes dos sesgos** ficam escondidos até o usuário completar o
  módulo.
- **Cache busting:** cada deploy que toca JS/CSS bumpa o `?v=YYYYMMDDx`
  em `index.html` e `admin.html`. `sesgos.js` e `supabase.js` também
  carregam com `?v=` porque são ES imports diretos (o browser cacheia
  por URL).

## 5. Supabase — dados principais

Ver `SUPABASE_SCHEMA.md` para DDL completo. Tabelas:

| Tabela | O que tem |
|---|---|
| `users` | email, name, created_at, onboarding_seen_at |
| `progress` | bit_done, bit_result, bit_answers (jsonb), sesgos (jsonb), report_seen_at, next_steps_done |
| `app_sessions` | uma linha por login, screens (jsonb), last_screen, started_at/last_seen_at |
| `question_responses` | cada resposta individual (BIT, escenarios, fixation) |
| `question_feedback` | ratings de "¿qué tan útil?" por pergunta |
| `content_feedback` | ratings por bloco de conteúdo (definição, ejemplos, etc) |
| `next_steps_responses` | intereses marcados pelo aluno |
| `bug_reports` | FAB "Reportar un problema" — sincronizado com Notion |
| `client_errors` | fetchs que falharam no client — sincronizados com Notion |
| `backup_log` | metadata de cada backup (ver §7) |

### Pattern de acesso

Todo request vai por `request()` em `public/js/supabase.js` → `fetch`
direto no PostgREST. Upsert de progresso:

```
POST /rest/v1/progress
Prefer: resolution=merge-duplicates,return=representation
```

O JWT do usuário é setado via `setSession(accessToken)` e guardado em
`localStorage`. Exceções notáveis:
- `submitBug` usa o **anon key direto** (não o JWT do usuário) pra
  evitar 401 quando a sessão expira numa aba aberta por horas.
- `fireAndForgetClientError` também usa anon direto, com `keepalive`.

## 6. Backoffice

`admin.html` — login separado com senha simples. Abas:

- **Resumen** — KPIs, funnel, distribuição de perfis BIT
- **Preguntas** — por pergunta, taxa de uso/erro, flag como "problema"
- **Usuarios** — lista + drawer com detalhe do aluno
- **Feedback** — ratings consolidados
- **Errores** — client_errors + bug_reports
- **Backups** — lista de dumps + explorer (ver §7)

Admin faz polling a cada 30s. Acesso read-only para a maioria das
tabelas via policy "anon can read …".

---

## 7. Sistema de backup

### Por quê existe

Se o texto de uma pergunta mudar depois que um aluno já a respondeu,
a coluna `question_id` não carrega a história. `bit_1` hoje pode ter
um prompt diferente do que o aluno viu semana passada.

O backup resolve congelando, a cada execução:
1. O conteúdo de **todas as tabelas** (dumps JSON)
2. Um **snapshot das perguntas** mapeado por `question_id`, com o
   texto e opções *como existiam naquele momento*

Assim, para qualquer resposta antiga, olhando o backup cujo timestamp
é ≥ `created_at` da resposta, dá pra reconstruir exatamente o que o
aluno viu e o que ele escolheu.

### Arquivos

| Caminho | Função |
|---|---|
| `scripts/backup.mjs` | script Node que faz o dump |
| `.github/workflows/backup.yml` | cron semanal no GitHub Actions |
| Supabase `backup_log` | log de cada execução com `fingerprint` |
| `G:\Mi unidad\Interlegere\finanzas-conductuales-backups\` | destino local dos dumps (no Google Drive) |

### Execução manual

```bash
node scripts/backup.mjs

# ou, custom path
BACKUP_DIR="/h/backups" node scripts/backup.mjs
```

Comportamento:
1. Carrega `public/data/questions.js` + `sesgos.js` via dynamic import
2. Constrói o `questions_snapshot` — inclui BIT, escenarios,
   verificação conceptual, self-assessment, report step feedback, etc.
3. Busca contagem de linhas de todas as tabelas
4. Calcula `fingerprint = sha256(row_counts + questions_hash)`
5. Busca `backup_log` ordenado por `created_at desc`, pega o último
6. Se `fingerprint` bate → imprime "No changes since <stamp>. Skipped."
   e termina. **Não cria pasta. Não insere linha.**
7. Senão → cria pasta timestampeada, escreve os JSONs, escreve
   `_summary.json`, insere linha em `backup_log`.

### Garantias

- **Imutabilidade:** cada backup é pasta própria com stamp único.
  `mv`, `rm` e escrita acidental só ocorrem se o usuário fizer
  manualmente.
- **Idempotência:** rodar 5 vezes seguidas sem mudanças → 1 pasta
  criada, 1 linha em `backup_log`.
- **Observabilidade:** `backup_log` preserva histórico mesmo se os
  arquivos físicos forem apagados.

### Automação semanal

`.github/workflows/backup.yml` roda `node scripts/backup.mjs`:
- **Schedule:** domingo 03:00 UTC
- **Manual trigger:** `gh workflow run "Weekly backup"` ou no GitHub UI
- **Artifact:** JSON output fica anexado ao run por **90 dias**
  (download pelo UI de Actions ou `gh run download <id>`)
- **Metadata:** vai pra Supabase `backup_log` para sempre

Importante: em CI o `BACKUP_DIR` é `./backup-output` (volátil). O
efeito real durável é o `backup_log` + o artifact. Para retenção
permanente, rode local e confie no Drive.

### Explorador no admin

Tab **Backups** do admin lista todos os `backup_log` com Δ (diff de
filas vs backup anterior). Botão **Explorar** abre um drawer que:

1. Pede a carpeta do backup via `<input type="file" webkitdirectory>`
2. Lê os JSONs **local no browser** (nada sobe a nenhum servidor)
3. Valida `fingerprint` do `_summary.json` contra o `backup_log`
4. Mostra dropdown de alunos → drill-down com a jornada do aluno
   usando o texto *histórico* de cada pergunta

### Restauração

**Não há script de restore por design.** Se o texto das perguntas muda
com o tempo, restaurar dados antigos numa codebase nova pode não fazer
sentido. O propósito do backup é:
1. **Auditoria** — saber o que cada aluno respondeu exatamente
2. **Revisão pessoal** — o aluno poder rever sua experiência
3. **Recuperação cirúrgica** — se precisar, `INSERT` manual via
   Supabase SQL Editor a partir dos JSONs

Se no futuro o cenário mudar (e.g. perdeu-se uma tabela em produção),
é fácil escrever `scripts/restore.mjs` em ~50 linhas lendo os JSONs
e fazendo `POST /rest/v1/<tabela>` por batches.

### Schema de `backup_log`

```sql
CREATE TABLE public.backup_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stamp TEXT NOT NULL UNIQUE,
  location TEXT,
  user_count INT NOT NULL DEFAULT 0,
  progress_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  total_rows INT NOT NULL DEFAULT 0,
  table_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  questions_hash TEXT,
  fingerprint TEXT NOT NULL,
  note TEXT
);
-- RLS: SELECT + INSERT públicos (o script usa anon key).
```

---

## 8. Deploy

- `git push origin master` → Netlify auto-deploya de `public/`
- `netlify.toml` força HTML com `Cache-Control: no-cache` para que
  o cache-bust dos assets seja respeitado
- Nenhum pipeline de CI bloqueia o merge hoje — a cron de backup é
  o único workflow ativo

## 8.1 Triagem diária de erros

Rotina que roda às 5:00 CDMX todo dia, separa ruído de erro real e manda
digest por email com botões funcionais.

- **Cron:** `.github/workflows/error-triage.yml` (11:00 UTC)
- **Script:** `scripts/error-triage.mjs`
- **Edge Function:** `error-action` (recebe cliques dos botões)
- **Setup inicial:** `scripts/ERROR_TRIAGE_SETUP.md` (secrets a adicionar)

Fluxo:
1. Pega `client_errors` com `triage_status='pending'`
2. Ruído conhecido (JWT heartbeat, aborted fetches) vira `noise` silencioso
3. Erros reais → Claude API analisa cada um (significado, impacto, fix, risco)
4. Resend envia email digest com botões `Corregir` / `Dejar para después` / `Ignorar`
5. Botões batem na Edge Function com HMAC token → atualizam DB

Colunas novas em `client_errors`: `triage_status`, `triaged_at`,
`triage_notes` (jsonb com output da análise), `action_taken`, `action_at`.

## 9. Notion sync (bugs + erros)

Cron externo (prompt-based) puxa linhas não sincronizadas de
`bug_reports` e `client_errors` para a database "Tarefas" do Notion
(Projeto=IBERO). Detalhes em [CLAUDE.md](CLAUDE.md) e
[notion_sync_prompt.md](notion_sync_prompt.md).

## 10. Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| Submit de bug report retorna 401 | JWT do usuário expirou numa sessão longa | Já corrigido: `submitBug` usa anon key direto |
| `pg_dump: command not found` ao backupar | Não tem Postgres client instalado | Não precisa — `backup.mjs` usa só fetch |
| Backup não detecta mudanças | Fingerprint bate com anterior | Correto — significa zero diff. Force-skip não existe por design |
| Admin mostra 0 backups | Row-level security bloqueando leitura | Verificar policy `anon can read backup_log` na tabela |
| "No changes since …" em CI mas quero gerar um | Adicionar `note` no script ou fazer um change real. Não há flag `--force` |
| User data aparece com texto diferente do que lembro | Texto da pergunta mudou entre a resposta e agora | Abrir backup anterior → `questions_snapshot.json` tem o texto original |

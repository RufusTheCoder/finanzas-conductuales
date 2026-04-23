# Setup — rotina diária de triagem de erros

Rotina que roda todo dia às **5:00 CDMX** (11:00 UTC), filtra ruído sozinha,
e manda um email com os erros reais + botões para **corrigir / dejar para
después / ignorar**.

## 1. Gerar o segredo HMAC

Este segredo é compartilhado entre (a) o script que monta os links do email
e (b) a Edge Function `error-action` que valida os cliques.

```bash
# gera 64 chars hex aleatórios
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde o valor gerado — vai entrar em **dois** lugares:

### 1a. Supabase Edge Function secret

Dashboard Supabase → Project Settings → Edge Functions → Secrets → **Add
new secret**:

| Nome | Valor |
|---|---|
| `ERROR_ACTION_SECRET` | (o hex gerado acima) |
| `SUPABASE_URL` | `https://ncausitrddvtoyivolkj.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (copiar de Project Settings → API) |

> A Edge Function já lê esses três via `Deno.env.get`.

### 1b. GitHub Secrets do repo

Settings → Secrets and variables → Actions → **New repository secret**,
uma vez para cada:

| Nome | Como obter |
|---|---|
| `SUPABASE_ANON_KEY` | `public/js/config.js` (já é a chave pública) |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| `RESEND_API_KEY` | https://resend.com/api-keys (plan grátis dá pra 100/dia) |
| `ERROR_ACTION_SECRET` | **mesmo valor** do passo 1a |
| `NOTIFICATION_EMAIL` | seu email (`emaildorodrigomarques@gmail.com`) |
| `RESEND_FROM` | `"Finanzas Conductuales <onboarding@resend.dev>"` (ou teu domínio verificado) |

## 2. Testar manualmente

Depois de adicionar os secrets, dispara o workflow na mão:

```bash
gh workflow run "Daily error triage"
gh run watch
```

Se não tem erros `pending`, vai imprimir `Nothing to email.` e terminar sem
mandar email. Para forçar teste, reabrir um erro:

```sql
UPDATE client_errors SET triage_status='pending' WHERE id=<algum id>;
```

## 3. O que cada botão do email faz

| Botão | Ação |
|---|---|
| ✓ **Corregir** | Marca `triage_status='fixed'`. Reaparece no digest se ocorrer de novo (novo row, novo `dedupe_hash`). |
| ⏳ **Dejar para después** | Marca `deferred`. Não reaparece por 7 dias (controlado pelo próprio digest). |
| ✕ **Ignorar** | Marca `ignored`. Erros futuros com o mesmo `dedupe_hash` também serão filtrados como ruído. |

Todos os botões batem em:
```
https://ncausitrddvtoyivolkj.supabase.co/functions/v1/error-action?id=…&action=…&token=<hmac>
```
com o token HMAC que só o cron sabe gerar — ninguém consegue disparar ações
sem ter o segredo.

## 4. O que conta como ruído (auto-ignorado)

Hoje o script filtra sozinho, sem mandar email:
- `updateSession` com `401` (JWT expired heartbeat)
- `submitBug` com `401` (mesma família)
- Qualquer `message` com "JWT expired"
- Fetch abortado (`AbortError` / `Failed to fetch` com status 0)

Para adicionar mais padrões, edita `NOISE_RULES` em
`scripts/error-triage.mjs` e commita.

## 5. Custos esperados

- **Resend:** grátis até 100 emails/dia — impossível encostar no limit com 1 digest diário.
- **Anthropic API:** ~$0.05–0.10 por digest de 3–5 erros usando Opus 4.7. Se for demais, troca `MODEL` em `error-triage.mjs` por `claude-haiku-4-5-20251001` (~10x mais barato).
- **GitHub Actions:** grátis no tier público.

## 6. Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Workflow falha com `Missing env: ANTHROPIC_API_KEY` | Secret não adicionado | Settings → Secrets → criar |
| Email chega sem botões clicáveis | `ERROR_ACTION_SECRET` no GH não bate com o da Edge Function | Sincronizar os dois |
| Clicar botão mostra "Token inválido" | Mesmo motivo acima | idem |
| Nenhum email chegando apesar de ter erros | Todos os erros caem em noise patterns | Checar log do workflow |
| Email cai em spam | `RESEND_FROM` usa `onboarding@resend.dev` (dominio default) | Verificar um domínio próprio em Resend |

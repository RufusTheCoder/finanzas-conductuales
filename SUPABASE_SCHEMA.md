# Supabase Schema

## Tabela `users`
- `id` UUID (PK)
- `email` text, unique, not null
- `name` text
- `password_hash` text
- `created_at` timestamptz default now()

## Tabela `progress`
- `id` UUID (PK)
- `user_id` UUID references `users(id)`
- `bit_done` jsonb
- `bit_result` text
- `bit_answers` jsonb
- `sesgos` jsonb
- `updated_at` timestamptz default now()

## Tabela `questions`
- `id` serial (PK)
- `phase` text not null  # ex: `bit`, `sesgo`, `fixation`, `comprehension`
- `sesgo_key` text          # ex: `anclaje`, `exceso_confianza`, apenas para sesgos
- `module` text             # ex: `BIT`, `Sesgos`, `Fixação`
- `prompt` text not null
- `options` jsonb not null  # lista de alternativas A/B, possivelmente mais
- `correct_answer` text     # opcional, útil para perguntas diagnósticas
- `importance` text default 'high'  # high/normal/low; BIT+sesgo devem ser high
- `diagnostic` boolean default true # indica se a pergunta é usada para identificar viés
- `quality_score` int default 0     # nota editorial inicial
- `response_rules` jsonb            # regras específicas de interpretação de respostas
- `metadata` jsonb                  # extras como `difficulty`, `context`, `source`
- `created_at` timestamptz default now()

## Arquivo SQL
- `SUPABASE_SCHEMA.sql` contém a criação de tabelas e índices para `questions` e `question_metrics`.

## Tabela `question_metrics`
- `id` serial (PK)
- `question_id` int references `questions(id)`
- `views` int default 0
- `answers` jsonb                   # ex: {"A": 120, "B": 80}
- `avg_time_seconds` numeric
- `confusion_rate` numeric          # ex: 0.35
- `feedback` jsonb                   # ex: {"clear": 12, "unclear": 3}
- `last_reviewed_at` timestamptz
- `created_at` timestamptz default now()

## Regras de RLS
- `users`: permitir apenas leitura/escrita para a própria conta
- `progress`: permitir acesso apenas ao `user_id` do usuário logado
- `questions`: leitura pública, escrita restrita ao admin/service-role

## Exemplo de upsert via REST
```
POST /rest/v1/progress
Headers:
  Authorization: Bearer <anon_key>
  apikey: <anon_key>
  Prefer: resolution=merge-duplicates,return=representation
Body:
  {
    "user_id": "<uuid>",
    "bit_done": {...},
    "bit_result": "PP",
    "bit_answers": {...},
    "sesgos": {...}
  }
```

## Observações
- A autenticação pode ser feita via Supabase Auth ou via tabela `users` customizada.
- Para keamanan, considere hashear senha no cliente antes de enviar e, idealmente, mover checks sensíveis para backend seguro.
- O front-end deve usar apenas `anon_key`; chaves de serviço não devem ser expostas.

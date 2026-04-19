# Finanzas Conductuales

Projeto inicial de plataforma educacional de finanças comportamentais para alunos da Universidad Iberoamericana CDMX.

## Estrutura atual
- `index.html` — versão v6 do produto, single-file com UI e lógica em HTML/CSS/JS
- `admin.html` — template inicial para backoffice
- `CONTEXT.md` — contexto do produto e regras do projeto
- `CHANGELOG.md` — histórico de versões
- `.cursorrules` — placeholder para uso com Cursor

## Próximos passos de arquitetura
1. Refatorar `index.html` em multi-arquivo:
   - `public/index.html`
   - `public/css/styles.css`
   - `public/js/config.js`
   - `public/js/app.js`
   - `public/data/questions.js` ou `public/data/questions.json`
2. Usar Supabase como backend:
   - Auth por email/senha via REST API
   - Auth social com Google/Gmail
   - `users` e `progress` no banco
   - `upsert` de progresso com header `Prefer: resolution=merge-duplicates,return=representation`
   - `public/js/supabase.js` implementa a camada REST
3. Criar ambiente seguro:
   - `.env` para `SUPABASE_URL` e `SUPABASE_ANON_KEY`
   - manter `service_role` apenas em backend/host confiável quando precisar de operações administrativas
4. Arquitetura de fluxos:
   - Login → Dashboard → BIT → Módulos de sesgos → Relatório final
   - Salvar progresso incrementalmente a cada módulo ou etapa
   - Permitir pausar e retomar o BIT a partir de onde o usuário parou
   - Exibir resultado e desbloquear cards conforme o usuário avança

## Infra sugerida
- Frontend estático em Netlify
- Banco Supabase para auth e dados
- Possível backend leve (funções serverless) se precisar de lógica de hashing ou regras adicionais
- Painel admin básico disponível em `admin.html`

## Arquivos de suporte
- `SUPABASE_SCHEMA.sql` — DDL para tabelas `questions` e `question_metrics`
- `SUPABASE_SCHEMA.md` — esquema de referência e regras gerais
- `GOOGLE_OAUTH_SETUP.md` — guia para configurar login com Google

## Como começar
1. Abra a pasta `finanzas-conductuales` no VS Code.
2. Configure o Git local:
   ```bash
   git config --global user.name "Seu Nome"
   git config --global user.email "seu@email.com"
   git add .
   git commit -m "feat: v6 — primeiro entregável completo"
   ```
3. Conecte ao GitHub e configure deploy automático no Netlify.
4. Crie `.env` a partir de `.env.example` antes de iniciar a refatoração.

## Notas
- Hoje o produto já tem um MVP funcional no `index.html`.
- O foco agora é mover a lógica de auth/progresso para Supabase e deixar o front mais modular.

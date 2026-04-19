# Arquitectura do Projeto — Finanzas Conductuales

## Objetivo
Montar um frontend estático organizado e um backend leve conectado ao Supabase para auth e persistência de progresso.

## Estrutura de pastas recomendada

finanzas-conductuales/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── data/
│       └── questions.js
├── .env.example
├── .gitignore
├── CONTEXT.md
├── CHANGELOG.md
├── README.md
└── SUPABASE_SCHEMA.md

## Frontend
- `public/index.html`: shell da aplicação e ponto de entrada.
- `public/css/styles.css`: estilos de layout, botões e cards.
- `public/js/config.js`: configuração de Supabase para o frontend.
- `public/js/supabase.js`: cliente REST para auth e gravação de progresso.
- `public/js/app.js`: lógica de tela, navegação e eventos.
- `public/data/questions.js`: modelo inicial de perguntas com BIT e sesgos.

## Banco de perguntas
- `questions`: armazena BIT e sesgos com `phase`, `sesgo_key`, `importance` e `diagnostic`.
- `question_metrics`: coleta estatísticas para avaliar qualidade de cada pergunta.
- Perguntas de compreensão podem ficar em `phase = comprehension` e `importance = low`.
- Admin panel em `admin.html` permite revisar e ajustar `quality_score` / `importance`.

## Backend / Infra
- Supabase REST API para autenticação e storage de dados.
- Auth por email/senha + Google OAuth
- `users`: e-mail, nome, password_hash, created_at.
- `progress`: user_id, bit_done, bit_result, bit_answers, sesgos, updated_at.
- `questions`: leitura pública, escrita por admin/service-role.

## Fluxo principal
1. Autenticação por email/senha
2. Dashboard com progresso e botão para iniciar BIT
3. BIT de 20 perguntas
4. 15 módulos de sesgos com diagnóstico + fixação
5. Relatório final com perfil, intensidade e recomendações

## Boas práticas
- Não expor `service_role` no frontend.
- Usar `.env` para `SUPABASE_URL` e `SUPABASE_ANON_KEY` localmente.
- Salvar progresso incrementalmente com upsert.
- Manter o HTML original como referência para o layout e copy.

## Próximos passos
1. Criar funções de login/signup no `app.js` usando Supabase REST.
2. Implementar persistência de sessão com `localStorage`.
3. Permitir pausar e retomar o BIT a partir do progresso salvo.
4. Transformar a UI de `app.js` em componentes de tela claros.
5. Adicionar admin mínimo em `admin.html` ou um novo painel para revisão de progresso.

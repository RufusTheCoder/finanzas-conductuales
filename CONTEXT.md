# Finanzas Conductuales — Contexto do Projeto

## O que é
Plataforma educacional de finanças comportamentais para alunos da Universidad Iberoamericana CDMX. Curso ministrado por Rodrigo Marques.

## Stack
- Frontend: HTML/CSS/JS single-file (sem framework)
- Backend: Supabase (projeto: ncausitrddvtoyivolkj.supabase.co)
- Deploy: Netlify (finanzas-conductuales.netlify.app)
- Auth: email/senha via Supabase REST API direto (sem SDK)

## Supabase
- Tabelas: `users` (email, name, password_hash, created_at) e `progress` (email, bit_done, bit_result, bit_answers, sesgos, updated_at)
- Acesso: REST API com publishable key, sem SDK
- RLS: for all using (true) with check (true)
- Upsert: POST + header `Prefer: resolution=merge-duplicates,return=representation`

## Estrutura do produto
Fluxo do aluno: Auth ? Dashboard ? BIT (20 perguntas) ? 15 módulos de sesgos ? Relatório final
Cada módulo: Quiz diagnóstico (2 cenários A/B) ? Explicação ? 3 perguntas de fixação ? Resultado (Tú vs REM + intensidade do sesgo)

## Perfis BIT
PP (Passive Preserver), FF/FK (Friendly Follower — chave interna FK, exibição FF), II (Independent Individualist), AA (Active Accumulator)

## Convenções de código
- Chave interna do Friendly Follower é FK (não mudar — quebra Supabase)
- Exibição usa bitLabel(code) que converte FK ? FF
- Cards de sesgos ocultam nome até módulo ser completado
- devSkip() e devFillAll() são funções de desenvolvimento, não aparecem para usuários normais

## Nomenclatura de arquivos
Versões: finanzas_conductuales_ibero_YYYYMMDD_vN.html (ex: 20260419v6)

## Próximos passos
- Refatorar em projeto multi-arquivo (separar CSS, JS, dados)
- Melhorar sistema de auth (hash de senha no cliente antes de enviar)
- Banco de dados de perguntas com métricas de qualidade por pergunta
- Adaptar para outros públicos (CEOs brasileiros, investidores PF)

# Configuração do Google OAuth no Supabase

## Passo 1: Configurar Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para "APIs & Services" > "Credentials"
4. Clique em "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure o consent screen se necessário
6. Selecione "Web application" como tipo
7. Adicione as seguintes URIs:
   - Authorized JavaScript origins: `https://your-domain.com` (ou `http://localhost:5500` para desenvolvimento)
   - Authorized redirect URIs: `https://your-supabase-project.supabase.co/auth/v1/callback`

## Passo 2: Configurar Supabase

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para "Authentication" > "Providers"
3. Ative o Google provider
4. Cole o Client ID e Client Secret do Google Cloud Console
5. Configure as URLs de redirect:
   - Site URL: `https://your-domain.com` (ou `http://localhost:5500`)
   - Redirect URLs: adicione `https://your-domain.com` e `http://localhost:5500`

## Passo 3: Testar

1. Abra `public/index.html` em seu navegador
2. Clique em "Continuar con Google"
3. Você será redirecionado para o Google para autorizar
4. Após autorização, será redirecionado de volta e logado automaticamente

## Notas importantes

- Para desenvolvimento local, use `http://localhost:5500` (porta padrão do Live Server)
- Para produção, use seu domínio real
- O Supabase cuida automaticamente da troca de códigos por tokens
- Os usuários do Google são criados automaticamente na tabela `users`

## Troubleshooting

- **Erro de redirect**: verifique se as URLs no Google Cloud e Supabase estão corretas
- **Erro de CORS**: certifique-se de que o domínio está na lista de origens autorizadas
- **Usuário não criado**: o sistema cria automaticamente o perfil na tabela `users` após OAuth
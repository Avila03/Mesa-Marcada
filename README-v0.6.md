# Mesa Marcada v0.6 — integração inicial ao Supabase

## Onde está o código

Trabalho em andamento na branch [feature/supabase-v0.6](https://github.com/Avila03/Mesa-Marcada/tree/feature/supabase-v0.6).

A aplicação v0.5 segue em `/demo.html` como referência. As primeiras telas reais ficam em:

- `/login` — cadastro e entrada por e-mail;
- `/painel` — dashboard, salas, sessões, presença, enquetes, lançamentos, rankings;
- `/demo.html` — demonstração local anterior e tutoriais.

## Como executar

1. Instale Node.js 22 e dependências: `npm install`.
2. Copie `.env.example` para `.env.local`.
3. No Supabase, abra **Project Settings > API Keys** e copie apenas a chave **publishable** (`sb_publishable_...`). Não use `service_role`, chaves secretas ou senha do banco.
4. Defina as duas variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Execute `npm run dev` e abra `http://localhost:3000/login`.
6. Confirme o e-mail após cadastro, caso o Supabase exija confirmação. Em **Authentication > URL Configuration**, adicione `http://localhost:3000/**` aos redirects de desenvolvimento.
7. Faça testes com duas contas distintas para validar confirmação individual e acesso restrito aos registros financeiros.

**Não envie `.env.local` ao GitHub**; ele está no `.gitignore`.

## Política aprovada: cadastro aberto (v0.6)

- Qualquer pessoa com acesso ao site pode criar sua conta por e-mail e senha; **não existe convite obrigatório**.
- A confirmação de e-mail é mantida quando configurada no Supabase Auth.
- A rota `/auth/callback` troca o código de confirmação (PKCE) por uma sessão autenticada.
- Contas autenticadas podem consultar o catálogo de salas e eventos, mesmo sem estar confirmadas nessas sessões. Os registros de compras de fichas, despesas e resultados continuam sujeitos às policies RLS por sessão.
- **Nota de privacidade:** o cadastro aberto também permite que desconhecidos visualizem o nome, a data e o local dos eventos. Evite inserir endereços residenciais detalhados em eventos públicos até termos controles adicionais de visibilidade.
- Antes de liberar o cadastro na internet, verifique em **Supabase > Authentication > Sign In / Providers > Email** se o login por e-mail está habilitado e confirme as configurações de registro e verificação do e-mail. O conector atual não disponibiliza leitura/alteração dessas preferências administrativas; é necessária uma conferência no painel.
- Proteja o cadastro com **CAPTCHA (Cloudflare Turnstile ou hCaptcha)** e revise limites de envio de e-mails/SMTP se o site for aberto ao público. A integração CAPTCHA ainda não foi construída no formulário.

## Preparação do deploy na Vercel

1. Acesse https://vercel.com/new, autorize o GitHub e importe `Avila03/Mesa-Marcada`.
2. Framework `Next.js`, diretório raiz `./`, branch de produção `main` (a `main` contém apenas a demonstração v0.5).
3. Configure **Preview** e depois **Production** com as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Somente a chave **publishable**, nunca `service_role` ou `sb_secret`.
4. Faça primeiro uma Preview da branch `feature/supabase-v0.6`; o pull request nº 1 permanece em rascunho. Não mescle à `main` antes dos testes com duas contas e revisão das proteções do cadastro aberto.
5. No Supabase, em **Authentication > URL Configuration**, mantenha `http://localhost:3000/**` nos redirects locais e adicione o endereço de Preview gerado pela Vercel com `/auth/callback`. Após escolher a URL definitiva, configure **Site URL** e esse URL explícito de callback.
6. Teste cadastro, confirmação de e-mail, login, logout, presença e isolamento financeiro em **dois usuários distintos**, sem dados sensíveis reais. Documente os resultados em `docs/TESTES-v0.6.md`.
7. Após validação e revisão final, considere mesclar a v0.6 e só então habilitar produção para os usuários.

A chave publishable é pública por definição, mas o acesso aos dados depende sempre do Auth e das políticas RLS. Não publique chaves secretas nem arquivos locais `.env`.

## Banco de dados

As migrações do MVP v0.6 foram aplicadas ao projeto Supabase `mazfsqoksabexhqrhyej`, com RLS nas dez tabelas.

- Perfis derivados do cadastro Supabase Auth;
- Salas e sessões;
- Confirmação de presença individual com limite de vagas transacional;
- Enquetes e votos;
- Compras de fichas, contagem final e despesas;
- Ranking geral em fichas calculado por função agregada, **sem exibir valores monetários privados**.

**Atenção:** migrações são um ponto de partida. A autorização das operações administrativas e o fluxo de revisão de valores financeiros ainda requerem refinamentos antes de dados reais ou produção.

## Limitações da primeira integração

- O fluxo de mudança de data ainda não é implementado: o banco impede alterações sem reconfirmação.
- O rateio inicial divide igualmente as despesas entre os confirmados e não registra pagamentos.
- Criar enquete envolve duas operações consecutivas; na próxima revisão isso deve ser transacional.
- Não há transferência de titularidade ou moderação avançada no painel.
- O ranking geral depende de sessões encerradas com registros completos e pressupõe escalas semelhantes de fichas.
- Os tutoriais permanecem na demonstração v0.5 até migração visual definitiva.
- Ainda faltam testes automatizados de permissão entre duas contas reais.

## Próxima entrega

Validar build CI e operações com 2 contas; revisar RLS, melhorar componentes e configurar deploy de teste na Vercel.

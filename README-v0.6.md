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

## Banco de dados

As duas migrações do MVP v0.6 foram aplicadas ao projeto Supabase `mazfsqoksabexhqrhyej`, com RLS nas dez tabelas.

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

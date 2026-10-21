# ♠ Mesa Marcada — v0.9

Aplicação web para organizar encontros presenciais de **Poker** e **Blackjack** entre amigos. Construída com **Next.js 16, React 19 e Supabase Auth/PostgreSQL**, publicada na Vercel. Visual **Dark Cards** inspirado no protótipo HTML v0.5, com prioridade para smartphones.

**[Abrir Mesa Marcada](https://mesa-marcada.vercel.app)** · [Versão demonstrativa original](https://mesa-marcada.vercel.app/demo.html)

## Funcionalidades principais

- **Duas mesas fixas:** Poker e Blackjack. Cada mesa tem tutoriais, regras e eventos.
- **Eventos:** criação, capacidade máxima, confirmação individual diretamente dos cards, cancelamento pelo Anfitrião, compartilhamento (WhatsApp/nativo/link) e calendário `.ics`.
- **Cadastro aberto:** login e senha com Supabase Auth, sem convite obrigatório. Confirmação de e-mail é configurável no dashboard do Supabase.
- **Perfis:** apelido, foto enviada pelo próprio jogador (Supabase Storage privado), jogo favorito, descrição, histórico e aba **Meus rachas** com valores a pagar e a receber.
- **Enquetes** somente dentro dos eventos; um voto por participante, alterável enquanto aberta.
- **Fichas e financeiro:** Fichas e Gastos em abas separadas. Compras/recompras por denominações 1/5/10/25/50; Anfitrião confirma os recebimentos. Em **Gastos**, cada participante confirmado escolhe entrar ou sair do racha individual de cada despesa; o perfil mostra valores a pagar e a receber, divididos exatamente em centavos.
- **Rankings:** Poker e Blackjack separados, filtros de mês/ano/histórico, sequências de noites positivas, melhores resultados, estatísticas e conquistas desbloqueadas nos perfis. Só entram eventos completos, revisados e não excluídos.
- **Segurança:** RLS em todas as tabelas públicas, validação de capacidade e autorizações no Supabase. Não são realizadas apostas, cobranças nem pagamentos pelo aplicativo.

## Executar localmente

Requer Node.js 22 e npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure em `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mazfsqoksabexhqrhyej.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_PELA_CHAVE_PUBLICA
```

A chave **publishable** é pública e utilizada com regras RLS. **Nunca** coloque uma chave `sb_secret_`, `service_role` ou senha do banco no frontend ou no GitHub.

Páginas: `/login`, `/painel`, `/evento/[id]` e `/demo.html` (protótipo antigo, apenas demonstração).

## Banco e migrações

As migrações efetivamente aplicadas estão em [`supabase/migrations/`](supabase/migrations/). O arquivo legado `lib/schema.sql` é um rascunho antigo: **não o execute**. Para mudanças novas no banco, crie uma migração com RLS antes de habilitar recursos no frontend.

## Qualidade e publicação

```bash
npm run typecheck
npm run build
npm run smoke
```

O GitHub Actions executa essas verificações em PRs e pushes. A Vercel publica automaticamente a branch `main`. Documentação por versão: [v1.5](README-v1.5.md), [v1.4](README-v1.4.md), [v1.3](README-v1.3.md), [v1.2](README-v1.2.md), [v1.1](README-v1.1.md), [v1.0](README-v1.0.md), [v0.9](README-v0.9.md), [histórico](CHANGELOG.md) e [testes](docs/TESTES-v0.9.md).

## Privacidade e limitações

**Cadastro aberto significa que qualquer usuário autenticado pode visualizar títulos, horários e locais dos eventos.** Não inclua endereços pessoais detalhados. Links de convite exigem login, mas não oferecem acesso restrito a convidados.

Os resultados financeiros são **registros informativos**. O rateio atual é igualitário, não representa obrigação legal ou transferência automática. O arquivo iCalendar usa duração estimada de quatro horas.

Testes automáticos de compilação, rotas e regras financeiras do banco não substituem uma homologação **com duas contas reais em celulares diferentes**. Há uma lista dos cenários pendentes em `docs/TESTES-v0.9.md`.

Código-fonte público: evite inserir dados privados, senhas e arquivos `.env.local` no repositório.

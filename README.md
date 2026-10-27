# Mesa Marcada — v6.3.0

Aplicação web para organizar encontros presenciais de **Poker, Blackjack, Truco, Canastra/Buraco, Pontinho, UNO e Pife** entre amigos. Construída com **Next.js 16, React 19 e Supabase Auth/PostgreSQL**, publicada na Vercel. Visual **Dark Cards** inspirado no protótipo HTML v0.5, com prioridade para smartphones.

**[Abrir Mesa Marcada](https://mesa-marcada.vercel.app)** · [Versão demonstrativa original](https://mesa-marcada.vercel.app/demo.html)

## Dashboard e navegação mobile

Na tela inicial, o jogador encontra seu **próximo evento**, confirmação de presença,
próximas noites, valores de rachas pendentes e atalhos para Poker, Blackjack e seus tutoriais.
A barra inferior do smartphone apresenta **quatro destinos**: **Início**, **Eventos**, **Ranking** e **Perfil**.
**Mesas** ficam acessíveis pelo Dashboard; a **Administração geral** é acessível pelo
Dashboard e pelo próprio Perfil somente para administradores. No desktop, a navegação
lateral mantém todos os destinos.

## Funcionalidades principais

- **Poker com duas variantes:** Texas Hold’em e Five Card Draw (Poker fechado), na mesma mesa, com tutorial interativo de troca de cartas.
- **31 conquistas:** 16 novas para participações, vitórias, duplas, variantes e ligas das novas modalidades.
- **Card de pós-jogo:** prévia da imagem no resumo do evento encerrado, download PNG e compartilhamento nativo quando disponível. Sem valores financeiros ou endereço cadastrado.

- **Sete mesas fixas:** Poker, Blackjack, Truco, Canastra/Buraco, Pontinho, UNO e Pife. Truco reúne Gaudério, Paulista e Mineiro na mesma mesa; Canastra/Buraco reúne Canastra, Buraco aberto e fechado. Cada evento define sua variante antes de começar.
- **Placar presencial:** equipes equilibradas, pontos por rodada, envites do Truco Gaudério, canastras, eliminação no Pontinho, cartas restantes no UNO e vitórias no Pife. Histórico, desfazer antes do encerramento e rankings por modalidade/variante no perfil e nas ligas. O aplicativo registra resultados conferidos pelos jogadores; não distribui cartas virtualmente.
- **Eventos:** criação, capacidade máxima, confirmação individual diretamente dos cards, cancelamento pelo Anfitrião, compartilhamento (WhatsApp/nativo/link) e calendário `.ics`.
- **Cadastro aberto:** login e senha com Supabase Auth, sem convite obrigatório. Confirmação de e-mail é configurável no dashboard do Supabase.
- **Perfis:** apelido, foto enviada pelo próprio jogador (Supabase Storage privado), jogo favorito, descrição, histórico e aba **Meus rachas** com valores a pagar e a receber.
- **Enquetes** somente dentro dos eventos; um voto por participante, alterável enquanto aberta.
- **Fichas e financeiro:** Fichas e Gastos em abas separadas. Compras/recompras por denominações 1/5/10/25/50; Anfitrião confirma os recebimentos. Em **Gastos**, cada participante confirmado escolhe entrar ou sair do racha individual de cada despesa; o perfil mostra valores a pagar e a receber, divididos exatamente em centavos.
- **Ranking anual:** Poker e Blackjack com classificações separadas, sem visão mensal. Cada jogador tem um saldo acumulado em reais e rendimento total do ano em uma única linha. Conquistas anuais nos perfis; só entram eventos encerrados, completos, revisados e não excluídos.
- **Segurança:** RLS em todas as tabelas públicas, validação de capacidade e autorizações no Supabase. Não são realizadas apostas, cobranças nem pagamentos pelo aplicativo.

## Aprender com as cartas

Em cada mesa, a aba **Tutorial e regras** abre exercícios próprios do jogo, um passo a passo ilustrado e perguntas frequentes. As variantes de Truco e Canastra/Buraco mudam os exemplos e as validações. Os exercícios são locais e não alteram placares. Os sete jogos usam esse padrão. No Poker, abra flop/turn/river, selecione cinco cartas e compare mãos; no Blackjack, calcule o total, compre/pare e acompanhe o dealer. As regras de S17/H17 são opções do exercício, sem alterar eventos.

Valide os exercícios com `npm run test:tutorials`. O módulo é carregado sob demanda, sem chamadas ao banco para praticar.

## Executar localmente

Requer Node.js 24 e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure em `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mazfsqoksabexhqrhyej.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_PELA_CHAVE_PUBLICA
```

A chave **publishable** é pública e utilizada com regras RLS. **Nunca** coloque uma chave `sb_secret_`, `service_role` ou senha do banco no frontend ou no GitHub.

Páginas: `/login`, `/recuperar-senha`, `/redefinir-senha`, `/painel`, `/eventos/[id]`, `/ranking`, `/perfil` e `/demo.html` (protótipo antigo, apenas demonstração).

## Banco e migrações

As migrações efetivamente aplicadas estão em [`supabase/migrations/`](supabase/migrations/). O arquivo legado `lib/schema.sql` é um rascunho antigo: **não o execute**. Para mudanças novas no banco, crie uma migração com RLS antes de habilitar recursos no frontend.

## Qualidade e publicação

```bash
npm run check:migrations
npm run check:reliability
npm run test:database
npm run typecheck
npm run build
npm run smoke
```

O GitHub Actions executa essas verificações em PRs e pushes. A Vercel publica automaticamente a branch `main`. Documentação por versão: [v1.7](README-v1.7.md), [v1.6.1](README-v1.6.1.md), [v1.6](README-v1.6.md), [v1.5](README-v1.5.md), [v1.4](README-v1.4.md), [v1.3](README-v1.3.md), [v1.2](README-v1.2.md), [v1.1](README-v1.1.md), [v1.0](README-v1.0.md), [v0.9](README-v0.9.md), [histórico](CHANGELOG.md) e [testes](docs/TESTES-v0.9.md).

## Privacidade e limitações

O acesso aos eventos segue as regras de visibilidade do evento e da liga no Supabase. Eventos públicos podem ser vistos por usuários autenticados; eventos privados exigem o vínculo ou convite correspondente. Evite inserir dados pessoais desnecessários em títulos e locais.

Os resultados financeiros são **registros informativos**. O racha é opcional por despesa, dividido igualmente entre os participantes que aderiram, não representando obrigação legal ou transferência automática. O arquivo iCalendar usa duração estimada de quatro horas.

Testes automáticos de compilação, rotas e regras financeiras do banco não substituem uma homologação **com duas contas reais em celulares diferentes**. Há uma lista dos cenários pendentes em `docs/TESTES-v0.9.md`.

Código-fonte público: evite inserir dados privados, senhas e arquivos `.env.local` no repositório.

## Atualizações do banco

O histórico foi reconciliado com as versões realmente aplicadas em produção. Operações históricas de limpeza ficam em `supabase/maintenance/*.disabled` e não são reaplicadas. Leia `supabase/README.md` antes de qualquer migração.

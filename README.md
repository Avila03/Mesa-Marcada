# Mesa Marcada — v7.0.1

Aplicação web para organizar encontros presenciais de **Poker, Blackjack, Truco, Canastra/Buraco, Pontinho, UNO e Pife** entre amigos. Construída com **Next.js 16, React 19 e Supabase Auth/PostgreSQL**, publicada na Vercel. Visual **Dark Cards** inspirado no protótipo HTML v0.5, com prioridade para smartphones.

**[Abrir Mesa Marcada](https://mesa-marcada.vercel.app)** · [Versão demonstrativa original](https://mesa-marcada.vercel.app/demo.html)

## Dashboard e navegação mobile

A página inicial prioriza partidas em andamento, o próximo encontro e avisos de rachas. Encontros com horário passado e sem início continuam disponíveis com o estado **Aguardando início**. Os quatro destinos principais são **Início**, **Eventos**, **Ligas** e **Perfil**; o catálogo **Jogos e tutoriais** fica em um acesso próprio.

Cada evento tem páginas de **Preparação**, **Partida**, **Despesas**, **Conferência** e **Resultado**, além de Enquetes e Gerenciar. O endereço preserva a tarefa ao atualizar, voltar ou abrir outra aba. Links anteriores de Ao vivo e Resumo continuam válidos. A preparação reúne assentos, equipes e início; a partida destaca os registros e mantém a ordem da mesa recolhida.

Criar/editar evento usa **Jogo e regras → Encontro → Conferir**, com rascunho por usuário/aba no navegador e revisão antes de salvar. Campos com 16 px, controles com pelo menos 44–48 px, navegação horizontal para telas estreitas e espaço para a área segura do iPhone. A liga separa **Eventos**, **Ranking** e **Membros**. O perfil abre as próprias páginas de conquistas, molduras, resultados, rachas e edição, mantendo os três troféus em destaque.

## Funcionalidades principais

- **Card de encerramento da liga:** no resumo final, escolha uma modalidade e prepare a imagem com brasão, campeão, campanha e pódio. Compacto 4:5 ou stories 9:16, prévia, salvar PNG e compartilhar. Usa apenas a classificação arquivada; empates esportivos geram títulos compartilhados, com escolha do campeão em destaque. Poker/Blackjack mantêm a classificação consolidada do arquivo e mostram participações, sem valores financeiros ou estatísticas de vitória inventadas. Ligas sem resultados não geram campeão.
- **Jogar novamente:** reutiliza modalidade, variante e regras no formulário; nova data e presenças obrigatórias, sem copiar lançamentos. Liga encerrada ou sem permissão não é reaproveitada.
- **Preparação e ordem:** sorteio de equipes equilibradas com ajuste antes de iniciar; guia compartilhado de distribuidor e primeiro jogador, com avanço manual por assento. Crupiê fixo no Blackjack e eliminados fora da próxima distribuição no Pontinho.
- **Perfil e foco na partida:** galeria única de 31 medalhas, molduras e resultados preservados; histórico do placar recolhido por padrão.

- **Poker com duas variantes:** Texas Hold’em e Five Card Draw (Poker fechado), na mesma mesa, com tutorial interativo de troca de cartas.
- **31 conquistas:** 16 novas para participações, vitórias, duplas, variantes e ligas das novas modalidades.
- **Card de pós-jogo:** sete modelos, placar e equipes reais, nome/brasão da liga e conquistas registradas no encerramento. Compacto 4:5 ou stories 9:16, prévia, PNG e compartilhamento nativo quando disponível. Sem valores financeiros ou endereço cadastrado. Eventos encerrados antes desta versão não recebem conquistas retroativas no card.

- **Sete mesas fixas:** Poker, Blackjack, Truco, Canastra/Buraco, Pontinho, UNO e Pife. Truco reúne Gaudério, Paulista e Mineiro na mesma mesa; Canastra/Buraco reúne Canastra, Buraco aberto e fechado. Cada evento define sua variante antes de começar.
- **Placar presencial:** equipes equilibradas, pontos por rodada, envites do Truco Gaudério, canastras, eliminação no Pontinho, cartas restantes no UNO e vitórias no Pife. Histórico, desfazer antes do encerramento e rankings por modalidade/variante no perfil e nas ligas. O aplicativo registra resultados conferidos pelos jogadores; não distribui cartas virtualmente.
- **Eventos:** criação, capacidade máxima, confirmação individual diretamente dos cards, cancelamento pelo Anfitrião, compartilhamento (WhatsApp/nativo/link) e calendário `.ics`.
- **Cadastro aberto:** login e senha com Supabase Auth, sem convite obrigatório. Confirmação de e-mail é configurável no dashboard do Supabase.
- **Perfis:** apelido, foto enviada pelo próprio jogador (Supabase Storage privado), jogo favorito, descrição, histórico e aba **Meus rachas** com valores a pagar e a receber.
- **Enquetes** somente dentro dos eventos; um voto por participante, alterável enquanto aberta.
- **Fichas e financeiro:** Fichas e Gastos em abas separadas. Compras/recompras por denominações 1/5/10/25/50; Anfitrião confirma os recebimentos. Em **Gastos**, cada participante confirmado escolhe entrar ou sair do racha individual de cada despesa; o perfil mostra valores a pagar e a receber, divididos exatamente em centavos.
- **Ranking por liga:** classificações dentro de cada liga, separadas por modalidade/variante. A aba global foi retirada; `/ranking` redireciona para `/ligas`. Estatísticas pessoais e conquistas permanecem nos perfis.
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

Páginas: `/login`, `/recuperar-senha`, `/redefinir-senha`, `/painel`, `/eventos/[id]`, `/ligas`, `/perfil` e `/demo.html` (protótipo antigo, apenas demonstração).

## Banco e migrações

As migrações efetivamente aplicadas estão em [`supabase/migrations/`](supabase/migrations/). O arquivo legado `lib/schema.sql` é um rascunho antigo: **não o execute**. Para mudanças novas no banco, crie uma migração com RLS antes de habilitar recursos no frontend.

## Qualidade e publicação

```bash
npm run check:migrations
npm run check:reliability
npm run test:league-cards
npm run test:journey
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

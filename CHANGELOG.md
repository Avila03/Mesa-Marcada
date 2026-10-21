# Histórico de versões — Mesa Marcada

## v1.6.1 — Ranking anual consolidado
- Remove os filtros Mês e Histórico da interface; avaliação exclusivamente pelo ano em curso.
- Todos os resultados válidos do ano aparecem consolidados em um único saldo por jogador.
- Ranking mostra juntos saldo anual de pontos, rendimento total e noites jogadas, sem cartões de métricas repetidos.
- Ordena pelo rendimento consolidado (saldo total ÷ pontos totais comprados) para evitar média de percentuais desconectados do volume de fichas.
- Mantém Poker e Blackjack separados porque as escalas de pontos não são necessariamente comparáveis.
- Conquistas passam a considerar somente eventos encerrados e aprovados do ano atual.
- Nenhum histórico de dados anteriores é apagado no Supabase.

## v1.6 — Dashboard de jogo e quatro destinos no celular
- Novo Dashboard compacto, orientado à próxima partida e à confirmação de presença.
- Resumo de eventos, presenças e valores próprios pendentes nos rachas.
- Próximos eventos acessíveis em um toque; mesas Poker e Blackjack com tutoriais por atalhos.
- Navegação inferior do smartphone exclusivamente com Início, Eventos, Ranking e Perfil.
- Mesas permanecem acessíveis por atalhos; Administração geral mantém entrada no Dashboard e Perfil do administrador.
- Menu lateral completo preservado no desktop; PWA e orientação de instalação permanecem no final.
- Cartões, botões e barra inferior ajustados para iPhone (áreas seguras e telas pequenas), com SVGs e Dark Cards v0.5.
- Check automatizado garante que os quatro destinos e os acessos secundários continuem disponíveis.

## v1.5.1 — Ícones consistentes no iPhone e Dashboard mais limpo
- Move orientações de instalação e avisos para o fim do Dashboard. Quando o PWA já está instalado, o cartão mostra somente preferências relevantes.
- Substitui símbolos inconsistentes do menu Início, Eventos, Mesas, Ranking, Perfil e Administração por SVGs com desenho e alinhamento padronizados.
- Botões Sair, Criar evento, Calendário, tutoriais, painéis de métricas e Administração também usam ícones vetoriais.
- Ajusta a área superior do aplicativo em iOS standalone para respeitar o espaço do relógio e bateria.
- Dashboard mostra em Próximas noites apenas eventos futuros (não eventos históricos agendados por erro).
- Adiciona check automatizado de interface ao CI.

## v1.5 — Temporadas, desempenho e conquistas
- Rankings de Poker e Blackjack separados, com filtros mês/ano/histórico.
- Saldo, percentual médio, melhor noite, participações e sequência positiva.
- Conquistas desbloqueadas nos perfis com base em noites efetivamente revisadas.
- Eventos ocultados administrativamente não influenciam os rankings.
- Validação por resultados completos e aprovados no PostgreSQL.

## v1.4 — Celular, instalação PWA e avisos
- Manifesto e Service Worker para instalar o site em tela inicial.
- Tela offline sem cache de informações financeiras, credenciais ou páginas privadas.
- Próximo evento no Dashboard, com confirmação de presença e acesso em um toque.
- Avisos de mudanças na agenda consultados enquanto o site estiver aberto, com permissão opcional.
- Instruções específicas para instalar no Safari (iPhone) e Android.
- Smoke HTTP passa a testar rotas PWA e garante que o worker não grava requisições pessoais em cache.

## v1.3 — Administração geral e Anfitriões
- Painel Administração restrito à conta cadastrada em `app_admins`, sem autoelevação.
- Lista de eventos, anfitriões, participantes, pendências e auditoria.
- Excluir da agenda é reversível; restaurar evento agendado reativa o status anterior.
- Eventos ocultados deixam de aparecer para usuários comuns também nas consultas do Supabase.
- Admin pode confirmar pagamentos, revisar fichas e encerrar eventos de outros Anfitriões.
- Histórico de alterações administrativas preservado.
- Host continua gerenciando seus próprios eventos, sem poderes sobre os demais.

## v1.2 — Acertos de rachas e financeiro pendente
- Quem pagou uma despesa pode confirmar ou reabrir o recebimento de cada pessoa no racha.
- O perfil separa valores pendentes de valores já acertados, sem movimentar dinheiro.
- Mudanças nos integrantes ou valor/credor da despesa invalidam acertos anteriores.
- RLS e funções autenticadas impedem terceiros de marcar dívidas como pagas.

## v1.1 — Marca oficial, foto no perfil e rachas por despesa
- Usa o novo emblema azul/vermelho enviado pelo Bruno na tela de login, no menu e no ícone da aplicação.
- Remove os emojis do perfil; jogadores aparecem com foto própria ou iniciais.
- Permite escolher foto no aparelho, cortar automaticamente em quadrado, remover e guardar no Storage privado com políticas por usuário.
- Separa as abas **Fichas** e **Gastos** em cada evento.
- Na aba Gastos, os participantes confirmados escolhem individualmente **Participar do racha** por despesa.
- O Anfitrião e o criador da despesa podem fechar e reabrir cada racha; grupos encerrados preservam quem entrou.
- O Supabase divide cada despesa em centavos sem diferença de arredondamento (R$ 100 / 3 = R$ 33,34 + R$ 33,33 + R$ 33,33).
- O perfil próprio mostra saldos **A pagar** e **A receber** por pessoa, despesa e evento.
- Os rachas não geram cobranças reais e não atribuem dívidas a quem não optou por participar.

## v1.0 — entrada mínima, Anfitrião e recebimentos
- Entrada mínima validada no banco e sinalizada na compra do celular.
- Compras anteriores abaixo do mínimo exigem completar a diferença na próxima compra.
- Anfitrião identificado no evento; pode cancelar seu evento preservando histórico.
- Anfitrião registra recebimento de compras em dinheiro e pode reabrir como pendente.
- Pagamentos pendentes bloqueiam aprovação de fichas e encerramento da partida.
- Conta em `app_admins` aparece identificada como Administrador geral; permissões globais seguem pendentes.
- Testes SQL de compras/recompras e aprovação de recibos, com rollback.

## v0.9.1 — Compras por denominação (21/10/2026)
- Tela de compra/recompra no evento com fichas físicas de 1, 5, 10, 25 e 50.
- Tabela padrão do grupo: R$ 1,00; R$ 5,00; R$ 0,10; R$ 0,25; R$ 0,50 por ficha.
- Eventos especiais permitem preços personalizados definidos ao criar o evento.
- Cálculo de R$ e de pontos no PostgreSQL, não apenas no navegador.
- Histórico mostra o detalhamento das denominações; compras anteriores são preservadas.
- Preços não podem ser alterados depois da primeira compra, inclusive se uma compra for excluída.
- Gravação transacional segura via RPC privada com checagem de presença e autorização.

## v0.9 — Eventos, perfis e revisão financeira (21/10/2026)
- Confirmação de presença nos cards e convite por WhatsApp/nativo, link e calendário.
- Redirecionamento seguro ao evento após autenticação.
- Perfis com avatar, nome, bio e jogo favorito.
- Estatísticas separadas por Poker e Blackjack, rendimento percentual e melhores saldos.
- Rateio igualitário de despesas com precisão de centavos e registro de quem pagou.
- Aprovação dos resultados individuais pelo organizador e bloqueio de encerramento incompleto.
- Exclusão de lançamentos próprios de fichas/despesas enquanto o evento está aberto.
- CI com smoke HTTP, TypeScript e build Next.js.

## v0.8 — Duas mesas fixas (21/10/2026)
- Mesas Poker e Blackjack permanentes com eventos e tutoriais incorporados.
- Ranking visual de mãos do Poker e calculadora de Blackjack.

## v0.7 — Mobile-first e Dark Cards (21/10/2026)
- Restaura o CSS original da v0.5 no painel React.
- Dashboard inicial, agendamento de eventos e navegação inferior no celular.

## v0.6 — Supabase e contas reais (20/10/2026)
- Supabase Auth, salas/sessões, presença individual, enquetes e financeiro.
- RLS e isolamento por usuário; primeira integração Vercel.

## v0.5 — Dark Cards (20/10/2026)
- Aplicada estética de baralho preto premium com acentos azul elétrico e vermelho.
- Mantidas navegação, formulários, salas, sessões, financeiro, rankings, enquetes e tutoriais.
- Persistência continua local ao navegador. Sem back-end real.

## v0.4 — Sessões e enquetes
- Criação de sessões com entrada mínima informativa, local e limite máximo de jogadores.
- Cada jogador confirma/cancela a própria presença.
- Enquetes de consumo por sessão com votos individuais.
- Preservação das abas e dados locais.

## v0.3 — Compras de fichas e rankings
- Compras e recargas por jogador, com quantidade de fichas e R$ separados.
- Ranking por sessão e acumulado de sessões encerradas.
- Registros de fichas finais e saldo por jogador.

## v0.2 — Tutoriais
- Guias separados de Blackjack e Texas Hold'em com regras, exemplos e perguntas frequentes.
- Calculadora interativa de pontuação do Blackjack.

## v0.1 — Estrutura inicial
- Next.js, App Router e TypeScript.
- Protótipo HTML independente incorporado ao Next.js.
- Salas, sessões, despesas e rateio demonstrativos.

## Próximos passos
- Migrar interface para componentes React.
- Adicionar Supabase Auth, Postgres e RLS antes de permitir dados reais.
- Implementar testes multiusuário e publicar ambiente de homologação.

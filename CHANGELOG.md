# Histórico de versões — Mesa Marcada

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

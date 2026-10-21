# Mesa Marcada v1.6.1 — Ranking anual sem poluição visual

## Alterações

- A interface não oferece mais o período **Mês** nem uma comparação mensal ou um painel de **Histórico**.
- O ranking mostra o **ano corrente** com todos os eventos válidos somados por jogador.
- **Saldo anual** = soma dos pontos finais menos os pontos comprados durante os eventos do ano.
- **Rendimento anual consolidado** = saldo anual ÷ pontos comprados ao longo de todos os eventos válidos do ano × 100.
- A ordenação é baseada no rendimento acumulado, não na média dos rendimentos de cada evento. As participações servem como informação contextual.
- As conquistas passam a ter o mesmo período anual para evitar inconsistências.
- Poker e Blackjack continuam em classificações diferentes porque suas pontuações podem utilizar escalas distintas.
- Os eventos e históricos de anos anteriores **permanecem armazenados**; apenas deixaram de ser exibidos no ranking atual.

## Segurança e compatibilidade

A função já existente `public.get_player_stats_period` é chamada exclusivamente com `p_period: "ano"`, sem mudar as permissões nem descartar partidas. Só são classificados eventos encerrados, completos, revisados e não excluídos pelo administrador.

## Validação

- GitHub Actions: `typecheck`, `build` e `smoke`.
- Revisão visual no celular ainda depende de conferência real pelo usuário.

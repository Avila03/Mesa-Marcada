# Mesa Marcada v1.5 — Rankings, temporadas e conquistas

## O que mudou
- Ranking de Poker e Blackjack com **mês atual**, **ano atual** e **histórico completo**.
- Ordenação por média percentual dos rendimentos de cada evento concluído (não pelo volume absoluto de fichas).
- Indicadores de saldo de fichas, número de noites válidas, noites positivas, melhor resultado e maior sequência positiva.
- Conquistas no perfil: Primeira noite, Presença de peso (5 eventos), Noite positiva, Sequência boa (3 positivos seguidos), Veterano (10 eventos) e Consistente (5 noites positivas).
- Eventos ocultados pelo Administrador não entram nos rankings, mesmo que já tenham sido encerrados.

## Regras técnicas
- Só entram sessões com status `finished` e todos os participantes tendo compras de fichas, fichas finais e revisão do Anfitrião ou Administrador.
- `get_player_stats_period` valida login pelo `auth.uid()`, agrega no PostgreSQL com função protegida e expõe apenas totais por jogador.
- A média de retorno é `AVG((fichas_finais - fichas_compradas) / fichas_compradas × 100)`.
- Sequências são medidas por resultados positivos consecutivos por jogador/modo, não como vitórias sobre outros participantes.
- Os períodos usam `starts_at` com cortes de mês e ano no relógio do banco. Em casos próximos à meia-noite, o fuso de referência do servidor pode divergir do fuso local.
- Nenhuma métrica envolve pagamento de apostas ou reais.

## Testes
- [x] Dois eventos temporários concluídos, comprados, recebidos e aprovados.
- [x] Identificação de duas noites positivas e sequência de 2.
- [x] Exclusão administrativa de um evento altera imediatamente o ranking para 1 noite válida.
- [x] Transação de QA revertida por `ROLLBACK`.
- [x] Supabase Security Advisor sem novas falhas críticas (alerta anterior de proteção de senhas vazadas).
- [ ] Teste manual com jogadores de Poker e Blackjack em celulares e períodos distintos.

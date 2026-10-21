# Mesa Marcada v1.2 — acertos no financeiro

A adesão aos rachas continua voluntária. Quem pagou uma despesa pode conferir sua lista de devedores, marcar cada parcela como **Recebida** ou reabrir como **Pendente**. Esse comando registra apenas um acerto feito fora do aplicativo.

No perfil, a seção **Meus rachas** soma apenas as parcelas pendentes, tanto em **A pagar** quanto em **A receber**. O histórico de acertos continua gravado na tabela `expense_split_settlements` até que a divisão seja alterada.

Para prevenir quitações incorretas, qualquer entrada ou saída do racha invalida automaticamente as confirmações anteriores. A mudança do valor ou da pessoa que pagou também invalida confirmações.

As confirmações estão protegidas no Supabase: só a pessoa marcada em **Quem pagou** pode confirmar recebimento. Usuários sem login ou que não sejam credores não podem alterar o estado.

## Testes
- Teste de dois usuários autenticados simulados, cada um confirmando sua presença.
- Devedor não consegue confirmar sua própria dívida.
- Credor confirma recebimento individual.
- Alteração da composição do racha invalida a confirmação.
- Transação temporária revertida com `ROLLBACK`.
- GitHub Actions: `typecheck`, `build`, `smoke`.

**Não há transações bancárias nem cobranças reais.**

# Mesa Marcada v1.7 — Evento ao Vivo

## Regras confirmadas

1. **Início manual pelo Anfitrião.** Nenhum evento inicia automaticamente por data ou horário. Somente a conta cadastrada como `organizer_id` consegue executar `start_live_event`, verificada no servidor.
2. **Linha do tempo privada.** Pode ser vista por contas com presença confirmada (`session_attendance`), pelo Anfitrião ou pelo Administrador. A mesma regra é aplicada por RLS a `session_live_state` e `session_live_activity`.
3. **Encerramento após conferência de fichas.** Depende de pelo menos um participante, compras, recebimento de todas as compras de fichas, fichas finais e aprovação do resultado de cada confirmado. Novos eventos exigem início manual prévio.
4. **Fichas ≠ Gastos.** A interface preserva as abas independentes **Fichas** e **Gastos**. Os rachas são voluntários, diferentes para comida e bebida, e **não impedem** encerrar a partida. Pagamentos de fichas são controles informativos, sem movimentar dinheiro.

## Experiência mobile-first

- Na tela do evento, o Anfitrião encontra o atalho **Iniciar ao vivo**.
- A aba **Ao vivo** mostra status (aguardando / em andamento / encerrado), início e ações de controle.
- A partida começa somente após confirmação do Anfitrião.
- Os participantes podem acompanhar a linha do tempo de forma cronológica, atualizada automaticamente a cada **15 segundos enquanto a aba está aberta e visível**, ou pelo botão **Atualizar**.
- A conferência mostra quantos participantes há, quantas compras de fichas já foram recebidas e quantos resultados estão aprovados.
- Botão **Conferir fichas** leva à aba Fichas. O botão **Encerrar partida** é liberado após todos os itens.
- Os gastos de alimentos e bebidas permanecem organizados na aba própria com adesão voluntária.

## Segurança e compatibilidade

- Alterações em `live_start_required` são proibidas por trigger. A coluna é `false` para eventos anteriores à migração e tem default `true` para novos eventos.
- As tabelas `session_live_state` e `session_live_activity` não aceitam `INSERT/UPDATE/DELETE` diretamente por contas comuns.
- Eventos ocultados pelo Administrador não deixam os demais consultarem a linha do tempo.
- Atividades são geradas por triggers do banco, e não por texto enviado pelo navegador.
- O histórico de eventos anteriores, rachas, compras e pagamentos não foi descartado.
- Não são gravados valores de rachas na linha do tempo.
- Atualização de 15 segundos por consulta. Notificações push com o aplicativo fechado continuam fora deste escopo.

## Validação

- [x] Banco: novo evento exige início manual antes de encerrar.
- [x] Apenas o Anfitrião inicia (não participante recebe erro).
- [x] Tentativa de iniciar duas vezes rejeitada.
- [x] Linha do tempo inacessível ao jogador não confirmado; confirmados podem consultá-la.
- [x] Sem permissões para forjar início, injetar atividades ou desligar a exigência.
- [x] Registro automático de presenças, compras, remoções e confirmação de pagamento.
- [x] Encerramento autorizado com despesa de comida aberta: gastos não bloqueiam a partida.
- [x] Testes SQL de ponta a ponta em transação, com `ROLLBACK` (não criaram eventos de teste permanentes).
- [ ] Teste prático em dois celulares (Anfitrião e participante).
- [ ] Validação visual e manual com participantes conectados.

## Como testar

Crie um **evento novo** (evite usar um evento real para testar o encerramento). Abra a aba **Ao vivo** como Anfitrião e toque em **Iniciar partida**. A segunda conta confirma presença e abre a mesma aba; veja se aparece a atividade de início. Registre a compra de fichas, confirme recebimento, insira fichas finais e aprove os resultados. Antes de encerrar, experimente adicionar uma despesa de comida sem integrantes no racha: o encerramento não dependerá dessa despesa.

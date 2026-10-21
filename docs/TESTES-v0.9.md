# Mesa Marcada v0.9 — checklist de qualidade

## Verificações executadas no desenvolvimento
- [x] Migrações do Supabase aplicadas sem perder o evento existente.
- [x] Novos campos de perfil, RLS da aprovação e duas funções RPC criadas.
- [x] `anon` sem permissão para executar RPCs de finanças e estatísticas.
- [x] Usuário autenticado sem acesso a evento privado recebe zero linhas da RPC financeira.
- [x] Erro de TypeScript/build resolvido nas alterações do v0.9 em branch.
- [x] CI na branch com `npm install`, `npm run typecheck`, `npm run build` e `npm run smoke` aprovados.
- [x] Vercel Preview do commit funcional aprovada (READY).
- [ ] Confirmar produção após merge.

## Teste transacional temporário executado no Supabase
- [x] Simulação autenticada de criação de evento, presença, compra/recompra, resultado e despesa.
- [x] Encerramento sem revisão foi recusado pelo servidor.
- [x] Aprovação foi automaticamente invalidada após alteração do resultado.
- [x] Após reaprovação, encerramento do evento foi permitido.
- [x] Saldo de fichas (+30) e quota financeira (R$ 1,01) estavam corretos.
- [x] Transação ROLLBACK: nenhum evento ou lançamento fictício permaneceu no banco.
- [x] 11 tabelas públicas com RLS e funções privadas indisponíveis para `anon`.

## Testes de aceitação que exigem duas contas distintas
- [ ] Usuário A cria evento; usuário B vê o evento e confirma em um toque no card.
- [ ] Usuário B abre convite compartilhado sem login e volta ao evento após entrar.
- [ ] Usuário A cancela presença; votos são removidos e vaga é liberada.
- [ ] Cadastro de perfil B com outro avatar; A vê o avatar mas não consegue editar.
- [ ] Evento de Blackjack aparece apenas na sua mesa.
- [ ] Ambos registram suas próprias fichas, e B não pode alterar as fichas de A.
- [ ] Usuário B não acessa valores privados de um evento em que não foi confirmado.
- [ ] Organizador aprova B, B altera fichas, aprovação desaparece.
- [ ] Encerrar evento com resultados pendentes é recusado.
- [ ] Com tudo revisado, o evento encerra e entra no ranking da modalidade.
- [ ] Rendimento percentual ordena corretamente jogadores com escalas diferentes.
- [x] Fórmula SQL de rateio: R$ 1,00 entre 3 pessoas gera R$ 0,34 / R$ 0,33 / R$ 0,33.
- [ ] Somente organizador pode declarar que terceiro pagou uma despesa.
- [ ] Compartilhar via WhatsApp e salvar iCalendar em Android e iPhone.

**Ainda não realizar esses cenários com dinheiro ou dados pessoais reais.**

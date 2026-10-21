# Mesa Marcada v0.9 — checklist de qualidade

## Verificações executadas no desenvolvimento
- [x] Migrações do Supabase aplicadas sem perder o evento existente.
- [x] Novos campos de perfil, RLS da aprovação e duas funções RPC criadas.
- [x] `anon` sem permissão para executar RPCs de finanças e estatísticas.
- [x] Usuário autenticado sem acesso a evento privado recebe zero linhas da RPC financeira.
- [x] Erro de TypeScript/build resolvido nas alterações do v0.9 em branch.
- [ ] Confirmar resultado final do CI com `npm run smoke` após a última alteração.
- [ ] Confirmar deploy Vercel Preview do último commit.
- [ ] Confirmar produção após merge.

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
- [ ] Despesa de R$ 1,00 entre 3 pessoas gera quotas 0,34 / 0,33 / 0,33.
- [ ] Somente organizador pode declarar que terceiro pagou uma despesa.
- [ ] Compartilhar via WhatsApp e salvar iCalendar em Android e iPhone.

**Ainda não realizar esses cenários com dinheiro ou dados pessoais reais.**

# Mesa Marcada v0.6 — Plano de testes de homologação

**Status:** cenários planejados; não interpretar esta lista como testes executados.
**Ambiente:** Preview Vercel, Supabase projeto `mazfsqoksabexhqrhyej`.
**Dados:** apenas fictícios, sem endereços completos nem dados financeiros reais.

## Cadastro aberto e autenticação

- [ ] Pessoa A sem convite cria conta com e-mail válido.
- [ ] E-mail de confirmação chega e link leva a `/auth/callback`, depois `/painel`.
- [ ] Login com senha errada apresenta falha; login correto funciona.
- [ ] Logout invalida a sessão e a aplicação pede novo login.
- [ ] Anônimo não consegue acessar registros privados por requisição direta.
- [ ] O envio de e-mail não apresenta restrição inesperada no plano/SMTP.
- [ ] Configurar CAPTCHA antes de abrir cadastro amplamente.

## Salas e sessões

- [ ] A cria sala, B autenticado enxerga o catálogo.
- [ ] B cria sessão em sala ativa de A.
- [ ] B informa nome, data/hora, local, entrada mínima informativa e limite máximo de pessoas.
- [ ] A e B confirmam somente suas próprias presenças; B não confirma em nome de A.
- [ ] Ao atingir o limite de participantes, a confirmação adicional é rejeitada pelo banco.
- [ ] Cancelar presença de A devolve vaga e remove seu voto nas enquetes daquela sessão.
- [ ] Não é possível criar sessão em sala arquivada.
- [ ] Mudança de horário sem reconfirmação fica bloqueada até implementar o fluxo.

## Enquetes

- [ ] Participante confirmado cria enquete com pelo menos duas opções.
- [ ] Cada participante tem apenas um voto por enquete e pode trocar de opção enquanto aberta.
- [ ] Usuário que não participa da sessão não vê resultados/votos nem consegue votar.
- [ ] Enquete encerrada não recebe mais votos.

## Fichas, gastos e rankings

- [ ] A registra suas próprias compras/recompras de fichas e reais em campos separados.
- [ ] B não altera nem exclui lançamentos de A via API, mesmo manipulando o navegador.
- [ ] B não visualiza valores de uma sessão de que não participa, exceto se for organizador.
- [ ] Confirmados podem consultar registros de outros participantes na mesma sessão.
- [ ] Rateio é estimativa e não cobra ou transfere valores.
- [ ] O ranking da noite soma fichas adquiridas e subtrai das fichas finais.
- [ ] O ranking geral por modalidade só contabiliza sessões encerradas e completas.
- [ ] Nomes e pontos gerais são visíveis a todos os cadastrados, valores em R$ privados por sessão.

## Verificação técnica

- [x] Banco possui 10 tabelas e RLS habilitado em todas.
- [x] Não há privilégios de SELECT de tabelas públicas para `anon`.
- [x] Security Advisor sem avisos após migração do ranking para invoker RPC (20/10/2026).
- [ ] Executar `npm run typecheck` e `npm run build` no commit atual.
- [ ] Testar redirecionamento de confirmação em localhost e Preview Vercel.
- [ ] Validar fluxo no Safari iOS e em navegador desktop.
- [ ] Exigir revisão humana antes de mesclar PR #1.

**Risco conhecido:** com cadastro aberto, qualquer conta verificada poderá ver salas, títulos, horários e locais. Não colocar endereços residenciais privados antes de definir controles adicionais de visibilidade.

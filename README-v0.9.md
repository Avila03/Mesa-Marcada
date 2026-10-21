# Mesa Marcada v0.9 — eventos, perfis, estatísticas e financeiro

**Visual**: preserva a folha de estilos Dark Cards original do HTML v0.5, com melhorias mobile-first.

## Funcionalidades

1. **Eventos:** confirmação diretamente do card ou na página do evento; compartilhamento nativo no celular (fallback WhatsApp), copiar link e exportação iCalendar `.ics`.
2. **Convites com autenticação:** `/evento/{uuid}` redireciona para `/painel?evento={uuid}`; quem precisa fazer login retorna ao evento após autenticar. Não há convite obrigatório para criar contas.
3. **Perfis:** apelido e avatar de naipe/emoji selecionável, jogo favorito, biografia curta e estatísticas por modalidade. Só o dono edita os próprios dados; o banco mantém a RLS.
4. **Ranking:** rendimento médio em porcentagem por sessão, melhor saldo de fichas, número de eventos e saldo bruto, separado por Poker e Blackjack. Só conta eventos encerrados cujos resultados foram conferidos.
5. **Financeiro:** registro da pessoa que pagou cada despesa, rateio igualitário em centavos no banco, diferença paga − quota e validação/aprovação dos resultados pelo organizador antes de encerrar.
6. **Proteções:** a aprovação financeira é automaticamente invalidada caso um resultado ou lançamento seja alterado. Apenas organizador pode declarar que outra pessoa pagou uma despesa.
7. **Mesas permanentes:** seguem apenas Poker e Blackjack, com tutoriais integrados.

## Banco

Supabase project `mazfsqoksabexhqrhyej`. Migrações:
- `20261021011447_mesa_marcada_v09_profiles_reviews_stats.sql`;
- `20261021012159_mesa_marcada_v09_harden_expense_payer.sql`.

As migrações foram executadas preservando as contas e eventos existentes. Elas acrescentam colunas ao perfil e à despesa, criam a tabela `session_finance_approvals`, duas RPCs protegidas e triggers de aprovação/encerramento. Todas as tabelas públicas seguem com RLS ativado.

## Segurança e privacidade

- Qualquer pessoa pode se cadastrar, conforme a decisão do projeto. **Qualquer pessoa cadastrada pode visualizar os títulos, datas e locais dos eventos**. Evite usar o endereço residencial completo.
- Convites são URLs; para ver os detalhes o destinatário precisa de conta autenticada, mas não precisa estar confirmado no evento. Não enviar URLs para terceiros desconhecidos se houver informação sensível.
- Compras de fichas, resultados, despesas e rateio ficam visíveis apenas a participantes confirmados e organizadores.
- Os valores em reais são informativos; nenhuma aposta ou pagamento é processado pelo aplicativo.
- Atualmente o rateio é sempre igual entre confirmados. Rateios personalizados não são suportados.
- A exportação iCalendar usa duração estimada de 4 horas; conferir antes de adicioná-la ao calendário.
- O cadastro aberto sem confirmação de e-mail exige atenção adicional ao risco de contas fraudulentas; CAPTCHA e senhas fortes são recomendados.

## Qualidade

- GitHub Actions: instalação, typecheck, build e smoke test HTTP das rotas Next.js.
- Checagens SQL de roles/permissions e validação de esquemas no Supabase.
- Testes manuais de duas contas, recebimento de convite, navegadores móveis e transações financeiras devem ser realizados antes de considerar a versão homologada.

A versão v0.9 foi criada em branch de desenvolvimento e segue o fluxo PR → CI → Vercel Preview → main.

## Fonte

`public/demo.html` e `app/v05-theme.css` preservam a referência da v0.5. Não usar o demo.html como banco de dados compartilhado.

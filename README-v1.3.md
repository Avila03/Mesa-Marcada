# Mesa Marcada v1.3 — Administração

O Administrador geral (previamente designado no SQL Editor, com RLS da própria conta) encontra a opção **Administração** na navegação. Ela apresenta:
- Número de jogadores, eventos agendados, compras pendentes e eventos excluídos.
- Lista de eventos por Anfitrião, datas, confirmados e receitas informativas de fichas.
- Filtros Visíveis / Todos / Excluídos, pesquisa por nome.
- Ações de cancelar e **excluir da agenda**. Exclusões são reversíveis e registradas na auditoria; ao restaurar, o evento agendado volta ao status agendado.
- Capacidade de confirmar pagamentos e aprovar fichas de eventos de outros Anfitriões, respeitando as mesmas exigências de encerramento.

## Segurança
- Nenhuma conta se eleva a admin pelo frontend. `public.app_admins` é protegida com SELECT próprio e sem INSERT por usuário autenticado.
- As ações do painel usam `public.admin_manage_event` com `SECURITY INVOKER`, que delega à função privada responsável por conferir `auth.uid()`.
- `sessions` tem RLS impedindo a consulta de eventos excluídos por usuários comuns.
- O Anfitrião continua restrito ao seu evento.
- Todas as ações do administrador são registradas em `event_admin_audit`, inclusive ocultação, restauração, cancelamento e encerramento.
- Eventos e lançamentos reais foram mantidos, sem deleções permanentes.

## QA
- [x] Teste temporário: admin oculta/restaura evento; não-admin não vê nem restaura.
- [x] Teste temporário: admin confirma recebimento, aprova fichas e encerra evento de outro Anfitrião.
- [x] Migrações de banco executadas com RLS e auditoria.
- [x] Testes SQL revertidos com ROLLBACK.
- [x] TypeScript, build Next.js e smoke HTTP aprovados.
- [ ] Homologação manual do painel e das opções de exclusão em celular.

Não foi implementada transferência de Anfitrião. Isso exigiria um fluxo adicional de aceite e reconfirmação de responsabilidades.

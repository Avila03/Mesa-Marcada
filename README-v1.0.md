# Mesa Marcada v1.0 — Anfitrião, mínimo e recebimentos

## O que funciona
- O campo `sessions.organizer_id` define o **Anfitrião** automaticamente na criação do evento.
- O Anfitrião pode cancelar seus eventos agendados, preservando dados históricos.
- A primeira compra precisa completar a entrada mínima. Se existir uma compra histórica de R$ 1 em evento de R$ 20, a próxima precisa ser de pelo menos R$ 19.
- Depois de completar o valor, as recompras são livres, acima de R$ 0.
- A compra é gravada pelo servidor via `record_chip_purchase`, e o gatilho valida o valor.
- Em **Fichas e gastos**, o Anfitrião registra **Recebido/Pendente** individualmente para cada compra. É somente registro do recebimento presencial.
- O Anfitrião não pode aprovar fichas enquanto existirem compras pendentes nem encerrar o evento com pagamentos ou resultados incompletos.
- A interface identifica a conta com registro em `app_admins` como **Administrador geral**; acesso à tabela de administradores está limitado por RLS à própria conta.

## Privilégios administrativos ainda pendentes
A conta do proprietário está cadastrada em `public.app_admins`, criada previamente pelo proprietário no SQL Editor. Esta branch **não** amplia direitos de UPDATE/DELETE sobre eventos alheios. A política para administração global e exclusão reversível de eventos depende de migração específica de autorização do banco, não de esconder/mostrar botões na interface.

## Segurança e compatibilidade
- Sem autoelevação de privilégios: apenas o banco pode cadastrar administradores.
- Pagamentos históricos entram como `pending`, jamais como `paid` presumido.
- Apenas o proprietário do evento pode confirmar recebimento enquanto ele estiver agendado.
- Evento cancelado mantém lançamentos para consulta; não permite novas compras.
- Não armazena credenciais, senhas, chaves privadas nem IDs pessoais no código.
- A estética continua baseada no CSS Dark Cards original da v0.5.

## Teste SQL temporário executado no Supabase
- Entrada mínima R$ 20 recusou compra inicial de R$ 1.
- Compra R$ 20 foi aceita, depois recompra de R$ 1.
- Pagamentos foram marcados recebidos somente pela conta Anfitriã.
- Aprovação anterior à confirmação foi bloqueada.
- Após confirmação e registro final de fichas, aprovação e encerramento funcionaram.
- `ROLLBACK` garantiu que nenhum evento fictício foi preservado.

## Validação adicional
- GitHub Actions: typecheck, build e smoke HTTP da aplicação.
- Teste manual com dois usuários (um anfitrião e outro participante) e celulares distintos ainda precisa ser feito.

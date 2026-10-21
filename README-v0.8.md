# Mesa Marcada v0.8 — duas mesas fixas e tutoriais

**Modelo visual:** Dark Cards original da v0.5, preservado em `app/v05-theme.css`.

## Nova estrutura
- Exatamente duas mesas no app: **Poker** e **Blackjack**; nenhuma ação de criar mesa.
- Mesas são categorias permanentes. Os **Eventos** continuam registros separados que pertencem a uma dessas mesas.
- Clique na mesa para acessar **Eventos** e **Tutorial e regras**.
- Tutorial do Poker (Texas Hold'em): etapas, decisões, ranking das 10 mãos com cartas ilustradas e FAQ.
- Tutorial do Blackjack: regras e comandos, exemplos visuais, FAQ e calculadora interativa da mão.
- O botão **Criar evento** continua acessível no dashboard, na lista de eventos, na aba da mesa e no botão flutuante mobile.
- Criar evento oferece apenas Poker ou Blackjack, sem cadastro de novas mesas.

## Persistência e proteção de dados
Migração `20261021004006_mesa_marcada_fixed_poker_blackjack_tables_v08.sql` normaliza os nomes das duas mesas existentes e as mantém ativas. Nenhum evento é apagado ou movido. Unique index em `rooms.game` e constraints impedem novas mesas duplicadas ou mudança de nome/status; permissões RLS seguem em vigor.

## Qualidade
Validação automática GitHub Actions: `npm install`, `npm run typecheck` e `npm run build`.
Testar após deploy em smartphone real e desktop com ao menos duas contas. Os tutoriais são públicos para usuários logados. Verificação de e-mail permanece configurada administrativamente no Supabase Auth.

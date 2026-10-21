# Mesa Marcada v0.7 — restauração visual Dark Cards e mobile first

## Design preservado

O arquivo app/v05-theme.css contém a folha de estilo integral da demo HTML **v0.5 Dark Cards**, seguida de adaptações específicas para React/mobile. A identidade grafite, preto fosco, gradientes, azul Poker e vermelho Blackjack, padrões de banners, cards, módulos e sidebar foi **reutilizada diretamente do original**, não redesenhada do zero.

## Fluxos
- Cadastro/login minimalistas, com só título e campos (retirados slogan, nota "cadastro aberto", descrição longa e link da demo).
- Dashboard ao entrar, métricas úteis e eventos próximos.
- CTA "Criar evento" na primeira tela e botão flutuante no celular.
- Criação de evento com opção de mesa existente ou "Criar nova mesa" **na mesma janela**.
- Navegação de 4 abas: Início, Eventos, Mesas, Ranking.
- "Enquetes", "Participantes", "Fichas e gastos" apenas dentro de cada evento.
- Páginas mobile-first com menu inferior e edição como bottom sheet.

## Banco
- Tabelas e colunas Supabase permanecem inalteradas (rooms=mesas, sessions=eventos).
- Login por senha utiliza Supabase Auth.
- **Verificação de e-mail**: retiradas mensagens de confirmação da tela, mas para remover a verificação de fato é obrigatório desativar **Confirm email** no Supabase em Authentication → Providers → Email. A integração atual não possui edição dessas configurações; o frontend não pode ignorar um requisito de autenticação do servidor.
- Recomendado configurar proteção antispam para cadastro aberto.

## Pendências
- Testes funcionais reais com pelo menos duas contas.
- Rever privacidade dos locais dos eventos, porque contas cadastradas veem eventos e locais.
- Ajustar regras de ranking entre escalas diferentes de fichas.
- Criação de enquete é um fluxo em duas chamadas ainda não transacional.

## CI
O GitHub Actions verifica npm install, npm run typecheck e npm run build.

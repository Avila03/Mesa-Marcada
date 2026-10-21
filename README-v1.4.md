# Mesa Marcada v1.4 — Experiência no celular

## Instalar
- **Android/Chrome**: abra o Mesa Marcada e escolha **Instalar aplicativo** no cartão do Dashboard (ou pelo menu do navegador).
- **iPhone/Safari**: abra o site no Safari, toque em **Compartilhar** e depois **Adicionar à Tela de Início**.
- O aplicativo abre diretamente em `/painel`, usa o visual Dark Cards e ocupa a janela standalone nos dispositivos compatíveis.

## Offline
- O Service Worker armazena apenas um HTML informativo de conexão e o logo.
- Sessões autenticadas, dados Supabase, gastos, fichas, fotos privadas e demais páginas não são armazenados no cache pelo Service Worker.
- Sem internet, o usuário recebe uma tela com o botão **Tentar novamente**; alterações precisam de conexão.

## Próximo evento e avisos
- O Dashboard destaca o próximo evento em que o usuário confirmou presença; caso não tenha confirmação, apresenta o próximo evento agendado.
- Confirmação de presença e detalhes acessíveis diretamente do destaque.
- A agenda é consultada a cada 60 segundos **enquanto a página está aberta e visível**. Quando há atualização, surge um aviso dentro do aplicativo e os eventos são recarregados.
- A permissão opcional de notificações do navegador permite avisos do sistema somente quando suportado e enquanto o aplicativo continua aberto. O serviço não dispara web push com app fechado.
- **Push em segundo plano requer VAPID, assinaturas e serviço de envio**, ainda não configurados.

## Testes
- TypeScript, build, smoke HTTP com `/manifest.webmanifest`, `/sw.js` e `/offline.html`.
- Homologação manual de instalação no iPhone e Android necessária.

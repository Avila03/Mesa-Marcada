# Mesa Marcada v1.7.1 — Interface sem saltos

Preserva Dark Cards e os dados existentes do Supabase.

- Criar evento abre diálogo fixo e congela a rolagem do Dashboard.
- A rolagem acontece apenas dentro do formulário, com cabeçalho e botões disponíveis.
- O iPhone usa viewport visual no teclado e campos com fonte de 16px para impedir zoom automático.
- Ao fechar, restaura a posição anterior. Ao criar, navega ao detalhe do evento pelo topo.
- Todas as páginas trocam de aba sem animação de rolagem, prevenindo a sensação de tela dançando.
- O modal trata Escape, Tab, foco inicial, foco de retorno e inércia do fundo.
- Nenhuma alteração financeira ou de dados foi necessária.

## Testes
- CI executa check:scroll, typecheck, check:ui, check:live, build e smoke.
- Validar manualmente no Safari/PWA do iPhone: abrir Criar evento após rolar, focar campos, digitar, fechar e confirmar a posição anterior.

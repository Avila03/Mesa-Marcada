# Mesa Marcada v1.6 — Dashboard e navegação inferior simplificada

## Novo Dashboard

A tela inicial destaca:
- **Próximo evento futuro**: data, horário, local, modalidade, confirmados e status da sua participação.
- **Confirmar presença** no próprio destaque quando o jogador ainda não estiver confirmado.
- **Próximas noites** em uma lista de até três eventos, abrindo cada detalhe com um toque.
- **Meus rachas**: valores individuais pendentes **a pagar** e **a receber**. Parcelas registradas como acertadas não entram na soma.
- **Mesas fixas** de Poker e Blackjack, com acesso aos próprios eventos e tutoriais.
- **Criar evento** em destaque e link para Ranking.
- **Administração** aparece apenas para contas autorizadas pelo Supabase.
- Preferências para instalar o PWA permanecem **no final** da tela.

## Barra inferior — smartphone

Quatro itens, nesta ordem:
1. **Início**
2. **Eventos**
3. **Ranking**
4. **Perfil**

Em eventos detalhados, Eventos permanece ativo. Dentro de Mesas, Início é destacado como origem do atalho. Dentro de Administração, Perfil aparece selecionado.

As telas de **Mesas**, regras e Administração **não foram removidas**. No computador, a navegação lateral mantém todas as opções.

## Responsividade

CSS Dark Cards (#080A0E, azul #258BFF, vermelho #FF424D como acento).
Os botões têm áreas de toque apropriadas; o menu inferior distribui os quatro destinos
em colunas iguais e respeita `safe-area-inset-bottom` em iPhone/PWA.
Não adicionamos bibliotecas de ícones ou dependências externas.

## Verificação automática

`npm run check:ui` agora verifica a composição da barra, preservação de Mesas/Admin,
posição do tutorial PWA e os atalhos do Dashboard. O CI também executa TypeScript,
build de produção e smoke das rotas HTTP.

## Homologação manual recomendada

- [ ] iPhone com Mesa Marcada instalado como PWA, em orientação retrato.
- [ ] Barra inferior exibindo exatamente quatro ícones SVG e títulos legíveis.
- [ ] Abrir Poker/Blackjack e tutoriais a partir do Dashboard.
- [ ] Acessar Administração pelo perfil e pelo Dashboard com a conta administradora.
- [ ] Confirmar presença diretamente do Dashboard usando uma conta comum.
- [ ] Conferir valores a pagar/receber com duas contas e um racha de teste.
- [ ] Conferir que eventos já ocorridos não aparecem como próximos.
- [ ] Conferir a posição das opções de PWA ao final da tela.

**Sem alterações de esquema ou credenciais do Supabase.** Os registros anteriores permanecem intactos.

# Mesa Marcada v0.9.1 — compras e recompras por fichas

## Tabela padrão (convenção do grupo)

| Valor impresso | Preço por ficha |
|---:|---:|
| 1 | R$ 1,00 |
| 5 | R$ 5,00 |
| 10 | R$ 0,10 |
| 25 | R$ 0,25 |
| 50 | R$ 0,50 |

**Importante:** número impresso representa pontos; preço unitário representa reais. Não há uma taxa de conversão única entre pontos e BRL.

## Interface
- Abrir evento → **Fichas e gastos** → **Compra ou recompra**.
- Em cada linha, usar botões `+` e `−` para escolher quantas fichas físicas recebeu.
- Total em reais = soma de (quantidade × preço daquela ficha); pontos = soma de (quantidade × número impresso).
- Tocar **Salvar compra** cria uma compra e suas denominações associadas no Supabase, em uma operação transacional.
- Histórico de compras e recompras mostra o total em pontos, o valor em reais e os itens (ex.: `3× ficha 10 · 2× ficha 25`).
- Só o participante confirmado pode lançar as próprias fichas, antes do encerramento.
- Registros antigos que não possuíam detalhamento por denominação continuam acessíveis, mas não mostrarão um recibo de denominações.

## Evento especial
- Formulário Criar evento → **★ Evento especial** → definir preços próprios de cada ficha.
- A opção **desmarcada** utiliza automaticamente os preços padrão.
- Preços são armazenados exclusivamente no evento. Alterá-los depois da primeira compra é bloqueado no PostgreSQL, mesmo que essa compra tenha sido removida.

## Esquema e segurança
- Colunas novas em `public.sessions`: flag de evento especial, preço de 1/5/10/25/50 e bloqueio de preços.
- Tabela `session_chip_purchase_items` guarda (compra, denominação, quantidade, preço unitário na compra), sob RLS.
- Compras continuam gravadas em `session_chip_purchases` para compatibilidade com financeiro e ranking.
- A operação de gravação é feita pela RPC pública `record_chip_purchase(uuid,jsonb)` com `SECURITY INVOKER`, que delega à função transacional privilegiada em `app_private`; a API recusa chamada anônima.
- A RPC valida sessão aberta, presença confirmada, quantidades 0..2.000 por denominação, total 1..5.000 fichas e lista de exatamente cinco números.
- Gravação não aceita que o navegador invente preços/valores; o servidor calcula tudo.
- Escrita direta em compras por `INSERT`/`UPDATE` foi revogada para usuários autenticados; exclusão das próprias compras abertas permanece disponível.
- Nenhum pagamento real é processado.

## Testes
- Teste transacional com rollback: [1,1,3,2,4] fichas corresponde a **R$ 8,80 / 286 pontos** com preços padrão.
- Evento especial com preços [2,3,4,5,6] e quantidades [2,0,0,0,1] corresponde a **R$ 10,00 / 52 pontos**.
- Compra sem presença foi bloqueada.
- Modificar preço após a primeira compra foi bloqueado.
- Compra direta sem passar pela RPC foi bloqueada.
- Todas as alterações de teste foram revertidas.
- GitHub Actions testa TypeScript, build Next.js e HTTP das rotas; Vercel Preview deve ficar READY antes do merge.
- É recomendada validação manual em smartphone com dois usuários para confirmar interação com controles e atualização do histórico.

O design usa o CSS Dark Cards original da v0.5 e as adaptações responsivas atuais.

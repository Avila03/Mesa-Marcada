# Mesa Marcada v1.1 — rachas opcionais e identidade oficial

## Interface
- Identidade visual enviada pelo proprietário e aplicada ao login, navegação e favicon. Mantém o tema **Dark Cards** da v0.5.
- Ícone de perfil discreto; sem emojis. Foto ou iniciais em formato circular.
- Perfil do próprio jogador: **Editar perfil → Foto de perfil → Escolher foto → Enviar foto**.
- Imagens preparadas no navegador (quadrado de 512 × 512, sem EXIF), máximo original 8 MB; bucket privado limita saída a 2 MB, WebP ou JPG.
- Fotos são acessíveis aos jogadores autenticados mediante URLs assinadas temporárias; cada usuário só atualiza a própria foto.

## Gastos e divisão
- A página do evento agora tem **Visão geral**, **Enquetes**, **Fichas** e **Gastos**.
- **Fichas**: compras/recompras, confirmações presenciais e resultados em fichas.
- **Gastos**: registrar gastos por categoria (Comida/Bebidas/Materiais/Outros), quem pagou e valor, além dos rachas voluntários.
- Cada despesa possui **Participar do racha** e **Estou no racha · Sair**; pessoas só podem participar enquanto confirmadas no evento e com racha aberto.
- Os integrantes de uma despesa não entram automaticamente nos rachas de outras. O pagador também só participa como integrante se optar por isso.
- Somente o criador da despesa ou o Anfitrião pode fechar/reabrir o racha, enquanto o evento estiver agendado.
- Um gasto sem integrantes **não cria dívidas**. Fechar um racha congela os participantes; não confirma transferência financeira.
- Rateio feito no PostgreSQL sobre centavos inteiros, com resto distribuído por data de adesão e ID.
- **Meus rachas**, no próprio perfil: dívidas com a pessoa que pagou e valores a receber de quem aderiu às suas despesas.
- A função financeira existente foi ajustada para não mais dividir despesas entre todos os confirmados automaticamente.

## Segurança
- `expense_split_members` usa RLS para leitura de membros confirmados/Anfitrião.
- Inserir/sair do racha passa por RPC autenticada + transação, valida presença e status do evento.
- RPC `get_my_expense_splits` é limitada à própria pessoa ou a quem pagou. Não permite consultar dívidas de usuários fora dos eventos de que participa.
- A alteração anterior de avatares usa Storage privado e políticas que limitam upload/exclusão à pasta do próprio usuário.
- Não existem transações, pagamentos ou cobranças pelo aplicativo.

## Migrações
- `20261021022737_mesa_marcada_profile_photos.sql`.
- `20261021023739_mesa_marcada_optional_expense_splits.sql`.

## Testes
- [x] SQL transacional com `ROLLBACK`: divisão de R$ 100 por dois participantes (R$ 50 por pessoa).
- [x] SQL transacional com `ROLLBACK`: quem não confirmou presença não participa.
- [x] SQL transacional com `ROLLBACK`: fechar um racha impede saída/entrada posterior.
- [x] O perfil do pagador calcula quanto a outra pessoa lhe deve.
- [x] Consulta SQL de segurança: bucket privado, regras de RLS e fotos publicadas somente pelo dono.
- [ ] Dois navegadores/celulares reais: validar envio, exibição e remoção de foto, adesão ao racha da comida sem adesão ao de bebidas.
- [ ] Verificar rotas após login e expiração de URL assinada para foto.

Toda divisão financeira é informativa: quem pagou continua sendo responsável por combinar a quitação diretamente com os participantes.

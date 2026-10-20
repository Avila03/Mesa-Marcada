# ♠ Mesa Marcada — MVP v0.5

Aplicação para organizar noites presenciais de **Poker** e **Blackjack** entre amigos, com salas, sessões, confirmações de presença, enquetes sobre consumo, registros de fichas, despesas, rankings e tutoriais.

## Estado atual: protótipo de demonstração

A versão **v0.5 — Dark Cards** aplica o tema escuro inspirado em baralho preto, com azul elétrico e vermelho.

**Importante:** os dados ainda são salvos somente no navegador (`localStorage`). A tela de entrada é demonstrativa, **não autentica usuários reais**, e o sistema **não sincroniza dispositivos**. Não publique dados pessoais ou financeiros privados antes da implementação de autenticação, autorizações e banco de dados.

## Como testar

### Sem instalar dependências

Abra o arquivo [`public/demo.html`](public/demo.html) no navegador. Se o acesso direto ao arquivo limitar o armazenamento local, execute um servidor HTTP simples:

```bash
python -m http.server 8000 -d public
```

Depois abra `http://localhost:8000/demo.html`.

### Com Next.js

Requer **Node.js 20.9+** e npm.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

O Next.js hospeda o mesmo protótipo HTML em um `iframe`. A interface ainda será migrada para componentes React/TypeScript.

## Funcionalidades do protótipo

- **Salas:** criação e visualização de salas de Poker e Blackjack;
- **Sessões:** título, data, horário, local, entrada mínima informativa em R$ e limite de participantes;
- **Presença:** cada perfil de demonstração confirma ou cancela a própria participação;
- **Enquetes:** perguntas com opções de consumo, votação individual e resultados;
- **Fichas:** compras, recompras, fichas finais e saldo por sessão;
- **Financeiro:** despesas compartilhadas e rateio por participantes;
- **Rankings:** por noite e geral acumulado, separados por modalidade;
- **Tutoriais:** regras básicas de Blackjack e Texas Hold'em, incluindo calculadora de pontuação do Blackjack.

Os registros em reais e as fichas/pontos **não são convertidos automaticamente**. Não há processamento de pagamentos nem apostas pelo sistema.

## Estrutura

```text
app/
  globals.css        Estilos básicos do shell Next.js
  layout.tsx         Metadados e layout
  page.tsx           Exibe a demonstração incorporada
public/
  demo.html          Interface funcional de demonstração v0.5
lib/
  schema.sql         Esboço para o futuro Supabase (NÃO executar em produção)
README.md
CHANGELOG.md
package.json
```

## Próximos passos

1. Refatorar a interface HTML para componentes Next.js/React.
2. Criar autenticação real via Supabase Auth.
3. Planejar, revisar e aplicar um esquema Postgres com **Row Level Security (RLS)** e validação de permissões no servidor.
4. Validar a confirmação de presença com limite de vagas transacional, enquetes e registros individuais.
5. Revisar o critério do ranking acumulado para sessões com escalas diferentes de fichas.
6. Testar com múltiplas contas e só então preparar a publicação na Vercel.

O arquivo `lib/schema.sql` é **apenas um rascunho incompleto**. Não deve ser aplicado no Supabase antes da revisão de segurança.

## Segurança e privacidade

Nunca envie `.env`, `.env.local`, senhas, chaves privadas, tokens de serviço ou dados pessoais reais para o repositório. O repositório está **público** no momento; caso queira restringir a visibilidade do código, altere-a nas configurações do GitHub.

Desenvolvimento: [histórico de versões](CHANGELOG.md).

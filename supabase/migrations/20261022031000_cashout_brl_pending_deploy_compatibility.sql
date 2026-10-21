-- Temporário: a nova interface de encerramento em reais aguarda permissão de publicação da Vercel.
-- Manter novos eventos compatíveis com o frontend antigo até o deploy de produção.
-- Após o deploy: adicionar migração ALTER TABLE ... SET DEFAULT true.
ALTER TABLE public.sessions ALTER COLUMN chip_settlement_brl SET DEFAULT false;

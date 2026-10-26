-- Compatibilidade temporaria com o frontend anterior ate a publicacao na Vercel.
ALTER TABLE public.sessions ALTER COLUMN chip_settlement_brl SET DEFAULT false;

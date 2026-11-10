-- Agendador dos lembretes "Hoje tem jogo" (2 horas antes).
-- Executado uma vez no projeto de produção (fora das migrações, porque
-- pg_cron/pg_net não existem no banco de testes). Idempotente.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='mesa-marcada-lembretes';
SELECT cron.schedule('mesa-marcada-lembretes','*/15 * * * *',
 $$SELECT net.http_get(url:='https://mesa-marcada.vercel.app/api/push/reminders',timeout_milliseconds:=10000)$$);
-- A rota é segura para chamadas repetidas: o banco só libera encontros
-- na janela de 2h–1h30 antes do início e nunca repete o lembrete.

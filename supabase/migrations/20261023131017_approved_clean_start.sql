-- Historical data cleanup already recorded in production. No schema changes.
-- Intentionally not replayed. Original: maintenance/approved_clean_start.sql.disabled
DO $$ BEGIN RAISE NOTICE 'Historical cleanup skipped'; END $$;

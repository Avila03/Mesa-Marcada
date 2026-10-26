# Database releases

`migrations/` uses the exact identifiers recorded in the production migration history as of 26 October 2026. `migration-baseline.json` records that baseline. New migrations must use `supabase migration new`, be tested in isolation, and be recorded using the same identifier returned by the deployment operation. Never rename an already-applied migration to a new timestamp.

For a fresh Supabase project, run `bootstrap.sql` in a trusted SQL session first. It creates the application administrator registry, which historically had been provisioned manually. It does not appoint an administrator. Supabase itself provides the Auth/Storage schemas.

One-time production cleanup and owner gifts are preserved in `maintenance/*.disabled`, outside the schema replay path. They are intentionally no-ops in the historical migrations: they do not define schema and must never be repeated during a release. Existing production grants, founder status, profiles and game records are unchanged. The historical push server-secret hash is not distributed; provision each environment separately.

Run `npm run check:migrations`, `npm run check:reliability` and `npm run test:database` before a release. The database test rebuilds the canonical history in isolated PostgreSQL and exercises actual database functions and RLS with fictional accounts.

The 5.2 release standardizes competitive results as integer BRL cents internally. Versioned ranking endpoints ending in `_v2` keep field names ending in `chips` for shape compatibility; original endpoints keep their historical units. Current ranking UIs label values in reais. Version-1 archived league reports retain their original points; version-2 reports explicitly declare `score_unit: brl_cents`. Physical chip values and purchasing prices are unchanged.

Do not run `db reset`, `migration repair`, the disabled maintenance files, or an unreviewed `db push` against production. A production release applies only its new reviewed migration, verifies it, then publishes the matching frontend.

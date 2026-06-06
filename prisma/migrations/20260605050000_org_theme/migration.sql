-- Tema/layout por cliente (white-label). Idempotente.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "theme" TEXT DEFAULT 'dark';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "corners" TEXT DEFAULT 'rounded';

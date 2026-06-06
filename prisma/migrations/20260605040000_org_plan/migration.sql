-- Planos/limites e marca por cliente (organização). Idempotente.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan" TEXT DEFAULT 'BASIC';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "maxEmployees" INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "brandColor" TEXT;

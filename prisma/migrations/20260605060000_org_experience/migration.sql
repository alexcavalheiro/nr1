-- Cor secundária e mensagem de boas-vindas por cliente. Idempotente.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "welcomeBanner" TEXT;

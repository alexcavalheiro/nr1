-- Segurança avançada (Bloco 3): perfis adicionais, validade de acesso e 2FA.
-- Idempotente. Aplicado pelo ensureDb no PGlite; no Supabase, rode manualmente.

-- Perfis adicionais (enum Role). ADD VALUE é idempotente com IF NOT EXISTS.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'UNIT_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SESMT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OCCUPATIONAL_DOCTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CIPA_MEMBER';

-- 2FA (TOTP) no usuário.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;

-- Validade de acesso no vínculo.
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3);

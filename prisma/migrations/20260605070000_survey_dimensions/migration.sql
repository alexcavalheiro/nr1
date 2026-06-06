-- Dimensões e pontuação por pergunta (módulo de diagnóstico psicossocial). Idempotente.
ALTER TABLE "SurveyQuestion" ADD COLUMN IF NOT EXISTS "section" TEXT;
ALTER TABLE "SurveyQuestion" ADD COLUMN IF NOT EXISTS "dimension" TEXT;
ALTER TABLE "SurveyQuestion" ADD COLUMN IF NOT EXISTS "reverseScored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SurveyQuestion" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "SurveyQuestion" ADD COLUMN IF NOT EXISTS "sensitive" BOOLEAN NOT NULL DEFAULT false;

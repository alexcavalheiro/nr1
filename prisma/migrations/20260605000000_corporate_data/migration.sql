-- Dados corporativos (Bloco 2 — importação/exportação de planilha padrão).
-- Idempotente: pode rodar mais de uma vez (IF NOT EXISTS). Aplicado pelo
-- ensureDb() no modo PGlite; no Supabase, rode este arquivo manualmente.

CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "cnpj" TEXT NOT NULL,
  "inscricaoEstadual" TEXT,
  "inscricaoMunicipal" TEXT,
  "endereco" TEXT,
  "cidade" TEXT,
  "estado" TEXT,
  "cep" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "status" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Company_organizationId_cnpj_key" ON "Company"("organizationId", "cnpj");
CREATE INDEX IF NOT EXISTS "Company_organizationId_idx" ON "Company"("organizationId");

CREATE TABLE IF NOT EXISTS "Partner" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT,
  "nome" TEXT NOT NULL,
  "cpfCnpj" TEXT,
  "tipo" TEXT,
  "empresaVinculada" TEXT,
  "empresaCnpj" TEXT,
  "percentual" TEXT,
  "cargo" TEXT,
  "dataEntrada" TIMESTAMP(3),
  "dataSaida" TIMESTAMP(3),
  "status" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Partner_organizationId_idx" ON "Partner"("organizationId");
CREATE INDEX IF NOT EXISTS "Partner_organizationId_cpfCnpj_idx" ON "Partner"("organizationId", "cpfCnpj");

CREATE TABLE IF NOT EXISTS "Contract" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT,
  "nome" TEXT NOT NULL,
  "tipo" TEXT,
  "empresaVinculada" TEXT,
  "empresaCnpj" TEXT,
  "parteRelacionada" TEXT,
  "dataInicio" TIMESTAMP(3),
  "dataVencimento" TIMESTAMP(3),
  "valor" TEXT,
  "status" TEXT,
  "responsavel" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Contract_organizationId_idx" ON "Contract"("organizationId");

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT,
  "nome" TEXT NOT NULL,
  "cnpjCpf" TEXT,
  "categoria" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "empresaVinculada" TEXT,
  "empresaCnpj" TEXT,
  "status" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Supplier_organizationId_idx" ON "Supplier"("organizationId");

CREATE TABLE IF NOT EXISTS "Obligation" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT,
  "nome" TEXT NOT NULL,
  "tipo" TEXT,
  "empresaVinculada" TEXT,
  "empresaCnpj" TEXT,
  "prazo" TIMESTAMP(3),
  "responsavel" TEXT,
  "status" TEXT,
  "prioridade" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Obligation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Obligation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Obligation_organizationId_idx" ON "Obligation"("organizationId");

CREATE TABLE IF NOT EXISTS "Pendency" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "empresaVinculada" TEXT,
  "empresaCnpj" TEXT,
  "responsavel" TEXT,
  "prioridade" TEXT,
  "status" TEXT,
  "dataLimite" TIMESTAMP(3),
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pendency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Pendency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Pendency_organizationId_idx" ON "Pendency"("organizationId");

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "fileName" TEXT,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ImportBatch_organizationId_createdAt_idx" ON "ImportBatch"("organizationId", "createdAt");

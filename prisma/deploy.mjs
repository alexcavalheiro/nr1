import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Aplica as migrations no Postgres de produção (Supabase) durante o deploy.
// Necessário porque, em modo Postgres, o ensureDb() é no-op e o `next build`
// não roda migrations — sem isto, as tabelas novas nunca existem em produção.
//
// Seguro/idempotente:
//   • Só roda quando DATABASE_URL aponta para Postgres (senão é PGlite e o
//     ensureDb cuida em runtime).
//   • O schema base (init) só é aplicado se a tabela "Organization" não existir.
//   • As migrations incrementais usam CREATE ... IF NOT EXISTS / ADD VALUE
//     IF NOT EXISTS, então podem ser reaplicadas sem efeito.
// =============================================================================

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("postgres")) {
  console.log("[migrate] DATABASE_URL não é Postgres — pulando (PGlite aplica em runtime).");
  process.exit(0);
}

// Migrations incrementais idempotentes, na ordem de aplicação.
const INCREMENTAL = [
  "20260605000000_corporate_data",
  "20260605010000_role_permissions",
  "20260605020000_access_security",
  "20260605030000_employees",
  "20260605040000_org_plan",
  "20260605050000_org_theme",
  "20260605060000_org_experience",
  "20260605070000_survey_dimensions",
];

/** Divide um arquivo .sql em statements individuais (sem comentários). */
function parseStatements(file) {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations", file, "migration.sql"), "utf8");
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function apply(prisma, file) {
  const statements = parseStatements(file);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log(`[migrate] ${file}: ${statements.length} statements aplicados.`);
}

/**
 * Reforço de segurança (lint Supabase 0013_rls_disabled_in_public): ativa RLS
 * na tabela interna do Prisma e tira o acesso dos papéis públicos da API.
 * Tolerante: a tabela/roles podem não existir (Postgres local), então nunca
 * derruba o deploy. As migrations do Prisma usam conexão privilegiada que
 * ignora o RLS, então isto não atrapalha.
 */
async function hardenRls(prisma) {
  const stmts = [
    `ALTER TABLE IF EXISTS public."_prisma_migrations" ENABLE ROW LEVEL SECURITY`,
    `REVOKE ALL ON TABLE public."_prisma_migrations" FROM anon`,
    `REVOKE ALL ON TABLE public."_prisma_migrations" FROM authenticated`,
  ];
  for (const s of stmts) {
    try {
      await prisma.$executeRawUnsafe(s);
    } catch (e) {
      console.warn("[migrate] RLS (ignorado):", e instanceof Error ? e.message : e);
    }
  }
  console.log("[migrate] RLS de _prisma_migrations reforçado.");
}

const prisma = new PrismaClient({ log: ["error"] });
try {
  const base = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."Organization"')::text AS t`);
  if (!base?.[0]?.t) {
    console.log("[migrate] schema base ausente — aplicando init...");
    await apply(prisma, "00000000000000_init");
  } else {
    console.log("[migrate] schema base presente.");
  }
  for (const m of INCREMENTAL) await apply(prisma, m);
  await hardenRls(prisma);
  console.log("[migrate] concluído com sucesso.");
  await prisma.$disconnect();
} catch (e) {
  console.error("[migrate] FALHA:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
}

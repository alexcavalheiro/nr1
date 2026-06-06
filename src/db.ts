import { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Conexão. Três modos:
//   • injected  → um client já posto em globalThis.prisma (usado pelos demos)
//   • postgres  → DATABASE_URL aponta para um Postgres real (produção)
//   • pglite    → fallback dev/local: Postgres em WASM persistido em disco
// Em modo pglite, ensureDb() aplica a migration e o seed no primeiro acesso.
// =============================================================================

const g = globalThis as unknown as {
  prisma?: PrismaClient;
  __pg?: PGlite;
  __dbReady?: Promise<void>;
};

function createPrisma(): PrismaClient {
  if (g.prisma) return g.prisma; // injetado (demos)

  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres")) {
    return new PrismaClient({ log: ["error"] });
  }

  // PGlite — roda sem instalar Postgres. Troque por um Postgres real definindo
  // DATABASE_URL=postgresql://... (e rode `prisma migrate deploy`).
  const dir = process.env.PGLITE_DIR ?? join(process.cwd(), ".pglite");
  const pg = new PGlite(dir);
  g.__pg = pg;
  return new PrismaClient({ adapter: new PrismaPGlite(pg) });
}

export const prisma = createPrisma();
// Cacheia no globalThis SEMPRE (inclusive em produção): com PGlite como datastore
// de runtime, o Next separa páginas e route handlers em chunks distintos; sem o
// cache global cada chunk criaria seu próprio PGlite e só um seria migrado.
g.prisma = prisma;

/**
 * Garante que o banco está pronto (migration + seed). No-op fora do modo pglite.
 * Memoizado: roda uma única vez por processo. Chame no topo de cada page/action.
 */
export function ensureDb(): Promise<void> {
  g.__dbReady ??= (async () => {
    const pg = g.__pg;
    if (!pg) return; // postgres real ou client injetado → nada a fazer aqui

    const exists = await pg.query<{ t: string | null }>(
      `SELECT to_regclass('public."Organization"') AS t`,
    );
    if (!exists.rows[0]?.t) {
      const sql = readFileSync(join(process.cwd(), "prisma/migrations/00000000000000_init/migration.sql"), "utf8");
      await pg.exec(sql);
    }

    // Migrations incrementais idempotentes (CREATE ... IF NOT EXISTS). Rodam a
    // cada boot no modo PGlite; no Postgres/Supabase são aplicadas manualmente.
    for (const extra of ["20260605000000_corporate_data", "20260605010000_role_permissions", "20260605020000_access_security", "20260605030000_employees", "20260605040000_org_plan", "20260605050000_org_theme", "20260605060000_org_experience", "20260605070000_survey_dimensions"]) {
      try {
        const sql = readFileSync(join(process.cwd(), `prisma/migrations/${extra}/migration.sql`), "utf8");
        await pg.exec(sql);
      } catch {
        // arquivo ausente ou já aplicado — ignora (idempotente).
      }
    }

    const { seedReference } = await import("./seed-bootstrap");
    await seedReference(prisma);

    // Tenant de demonstração + cenário (só se o banco estiver vazio).
    if ((await prisma.organization.count()) === 0) {
      const { seedDemoTenant } = await import("./seed-bootstrap");
      await seedDemoTenant(prisma);
    }

    // Garante o Super Admin (provedor) — idempotente. Login: super@nr1.com / super123.
    const { ensurePlatformAdmin } = await import("./services/platform.service");
    await ensurePlatformAdmin();
  })();
  return g.__dbReady;
}

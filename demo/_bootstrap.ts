import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Sobe um Postgres em WASM (PGlite, em memória), aplica a migration e injeta o
 * client no singleton de src/db.ts. Retorna o client e os serviços já carregados.
 */
export async function bootstrap() {
  const pg = new PGlite();
  const migration = readFileSync(
    join(__dirname, "../prisma/migrations/00000000000000_init/migration.sql"),
    "utf8",
  );
  await pg.exec(migration);
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;
  const svc = await import("../src/index");
  return { prisma, svc };
}

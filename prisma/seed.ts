import { prisma } from "../src/db";
import { seedDemoTenant, seedReference } from "../src/seed-bootstrap";

// Seed de produção (rode após `prisma migrate deploy`):
//   - dados de referência (categorias de risco, política LGPD, agentes de IA)
//   - tenant de demonstração + admin (admin@acme.com / admin123) se o banco estiver vazio
async function main() {
  console.log("🌱 Semeando dados de referência...");
  await seedReference(prisma);

  if ((await prisma.organization.count()) === 0) {
    console.log("🏢 Banco vazio — criando tenant de demonstração...");
    await seedDemoTenant(prisma);
  }
  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

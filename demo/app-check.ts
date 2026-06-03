// Verificação de runtime do app SEM browser: exercita o mesmo boot (ensureDb →
// migration + seed do tenant demo) e as mesmas queries do dashboard + o login.
process.env.PGLITE_DIR = `/tmp/nr1-appcheck-${Date.now()}`;

const line = () => console.log("─".repeat(64));

async function main() {
  const { ensureDb, prisma } = await import("../src/db");
  await ensureDb(); // aplica migration + seedReference + seedDemoTenant
  const { getHeatmap, getRanking } = await import("../src/index");
  const { verifyPassword } = await import("../src/auth-crypto");

  const org = await prisma.organization.findFirstOrThrow();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "admin@acme.com" } });

  // Login (núcleo da server action)
  const loginOk = verifyPassword("admin123", user.passwordHash);
  const loginBad = verifyPassword("senhaerrada", user.passwordHash);

  // Queries que o dashboard renderiza
  const [heatmap, ranking, insights, summary] = await Promise.all([
    getHeatmap(org.id),
    getRanking(org.id, 5),
    prisma.aiInsight.count({ where: { organizationId: org.id } }),
    prisma.executiveSummary.findFirst({ where: { organizationId: org.id } }),
  ]);

  line();
  console.log(`🏢 Tenant demo: ${org.name}`);
  console.log(`🔐 Login admin@acme.com/admin123 → ${loginOk}  | senha errada → ${loginBad}`);
  console.log(`🗺️  Heatmap por nível:`, heatmap.countsByLevel);
  console.log(`📊 Ranking (${ranking.length}): ` + ranking.map((r) => `#${r.rank} ${r.risk.title} (${r.priorityScore})`).join(" · "));
  console.log(`🧠 Insights de IA: ${insights}`);
  console.log(`📝 Resumo executivo: ${summary ? "gerado" : "ausente"}`);
  line();

  const ok = loginOk && !loginBad && heatmap.countsByLevel.CRITICAL >= 1 && ranking.length >= 1 && insights >= 1 && !!summary;
  console.log(ok ? "✅ APP (DADOS + LOGIN) VALIDADO" : "❌ Algo divergiu — revisar");
  if (!ok) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import {
  AutomationActionType,
  PrismaClient,
  QuestionType,
  SurveyType,
  SystemEventType,
} from "@prisma/client";

// =============================================================================
// DEMO END-TO-END — roda a plataforma inteira contra um Postgres em WASM (PGlite),
// sem instalar nada no sistema. Prova: pesquisa → respostas → derivação de risco
// → avaliação CRÍTICA → automação dispara alerta + plano de ação.
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const line = () => console.log("─".repeat(64));

async function main() {
  // 1) Postgres em memória + aplica a migration -----------------------------
  const pg = new PGlite();
  const migration = readFileSync(
    join(__dirname, "../prisma/migrations/00000000000000_init/migration.sql"),
    "utf8",
  );
  await pg.exec(migration);

  // 2) Prisma Client sobre o PGlite, injetado no singleton de src/db.ts ------
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;

  // 3) importa os serviços DEPOIS de injetar o client ------------------------
  const svc = await import("../src/index");

  console.log("🚀 PGlite + migration aplicada. Iniciando cenário...\n");

  // --- Setup organizacional ---
  const org = await prisma.organization.create({ data: { name: "Acme Indústria S.A." } });
  const dept = await prisma.department.create({
    data: { organizationId: org.id, name: "Operações" },
  });
  const burnout = await prisma.riskCategory.create({
    data: { code: "BURNOUT", name: "Burnout", description: "Esgotamento por estresse crônico." },
  });

  // --- Automação: risco CRÍTICO → notificar RH + alerta + criar plano (Fluxo 1) ---
  await prisma.automationFlow.create({
    data: {
      organizationId: org.id,
      name: "Risco crítico → resposta imediata",
      triggerEvent: SystemEventType.CRITICAL_RISK_DETECTED,
      enabled: true,
      actions: {
        create: [
          { order: 0, type: AutomationActionType.NOTIFY_HR, config: {} },
          { order: 1, type: AutomationActionType.SEND_ALERT, config: { alertType: "CRITICAL_RISK", title: "Risco crítico detectado" } },
          { order: 2, type: AutomationActionType.CREATE_ACTION_PLAN, config: {} },
          { order: 3, type: AutomationActionType.WRITE_AUDIT_LOG, config: {} },
        ],
      },
    },
  });
  // Webhook n8n assinando o mesmo evento
  await prisma.webhookEndpoint.create({
    data: { organizationId: org.id, url: "https://n8n.local/webhook/nr1", events: [SystemEventType.CRITICAL_RISK_DETECTED] },
  });

  // --- Módulo 2: pesquisa de clima com perguntas mapeadas a Burnout ---
  const survey = await svc.createSurvey({
    organizationId: org.id,
    title: "Pesquisa de Clima Q2/2026",
    type: SurveyType.CLIMATE,
  });
  const versionId = survey.versions[0].id;
  await svc.addQuestions(versionId, [
    { text: "Sinto que consigo descansar fora do trabalho.", type: QuestionType.LIKERT_5, riskCategoryId: burnout.id },
    { text: "Minha carga de trabalho é sustentável.", type: QuestionType.LIKERT_5, riskCategoryId: burnout.id },
  ]);
  await svc.publishVersion(versionId);

  const v = await prisma.surveyVersion.findUniqueOrThrow({ where: { id: versionId }, include: { questions: true } });
  const [q1, q2] = v.questions;

  // 4 respostas com notas BAIXAS (sinal de risco; escala 1=ruim..5=ótimo)
  const lows = [1, 2, 2, 1];
  for (let i = 0; i < lows.length; i++) {
    await svc.submitResponse({
      surveyId: survey.id,
      departmentId: dept.id,
      answers: [
        { questionId: q1.id, valueNumber: lows[i] },
        { questionId: q2.id, valueNumber: lows[3 - i] },
      ],
    });
  }
  line();
  console.log("📋 Módulo 2 — pesquisa publicada e respondida (4 respostas)");

  // --- Derivação automática de risco a partir das respostas ---
  const derived = await svc.deriveRisksFromSurvey(survey.id, { threshold: 2.5 });
  console.log("🔎 Riscos derivados:", derived);
  const riskId = derived[0].riskId;

  // --- Módulo 3: avaliação CRÍTICA (prob 5 × impacto 5 = 25) ---
  const assessment = await svc.assessRisk({ riskId, probability: 5, impact: 5 });
  line();
  console.log(`⚖️  Módulo 3 — avaliação: score ${assessment.score} → ${assessment.classification}`);

  // --- Módulo 4: priorização ---
  await svc.prioritizeRisk({ riskId, severity: 5, frequency: 4, financialImpact: 3, humanImpact: 5, legalImpact: 5 });
  const ranking = await svc.getRanking(org.id);
  console.log(`📊 Módulo 4 — ranking: #${ranking[0].rank} ${ranking[0].risk.title} (score ${ranking[0].priorityScore})`);

  // --- Módulo 6: heatmap ---
  const heatmap = await svc.getHeatmap(org.id);
  console.log("🗺️  Módulo 6 — heatmap por nível:", heatmap.countsByLevel);

  // --- O que a AUTOMAÇÃO produziu sozinha (disparada pelo evento crítico) ---
  line();
  const [alerts, plans, runs, deliveries, sources, audits, notifs] = await Promise.all([
    prisma.alert.findMany({ where: { organizationId: org.id } }),
    prisma.actionPlan.findMany({ where: { organizationId: org.id } }),
    prisma.automationRun.findMany(),
    prisma.webhookDelivery.count(),
    prisma.riskSource.count(),
    prisma.auditLog.count(),
    prisma.notification.count(),
  ]);
  console.log("🤖 Módulo 8 — automação disparada pelo risco crítico:");
  console.log(`   • AutomationRun: ${runs[0]?.status}`);
  console.log(`   • Alertas criados:        ${alerts.length}  (${alerts[0]?.type})`);
  console.log(`   • Planos de ação criados: ${plans.length}  (auto via automação)`);
  console.log(`   • Notificações (RH):      ${notifs}`);
  console.log(`   • Logs de auditoria:      ${audits}`);
  console.log(`   • Webhooks enfileirados:  ${deliveries}  → n8n`);
  console.log(`   • RiskSources (rastreio): ${sources}`);
  line();

  // --- Verificação automática do que importa ---
  const ok =
    assessment.classification === "CRITICAL" &&
    runs[0]?.status === "SUCCESS" &&
    alerts.length === 1 &&
    plans.length === 1 &&
    deliveries === 1 &&
    sources === 1;
  console.log(ok ? "✅ CADEIA COMPLETA VALIDADA" : "❌ Algo divergiu — revisar");
  if (!ok) process.exitCode = 1;

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

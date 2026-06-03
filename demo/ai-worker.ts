import { IndicatorType, QuestionType, SurveyType } from "@prisma/client";
import { bootstrap } from "./_bootstrap";

// =============================================================================
// DEMO — Worker de IA (Módulo 8). Roda os Agentes de Saúde Organizacional e
// Executivo sobre dados reais (pesquisas + indicadores) e prova que geram
// AiInsight e ExecutiveSummary. Tudo em PGlite, sem chaves de API.
// =============================================================================

const line = () => console.log("─".repeat(64));

async function main() {
  const { prisma, svc } = await bootstrap();
  console.log("🚀 PGlite pronto. Rodando agentes de IA...\n");

  const org = await prisma.organization.create({ data: { name: "Acme Indústria S.A." } });

  // Agentes padrão da plataforma (globais).
  await prisma.aiAgent.createMany({
    data: [
      { type: "ORG_HEALTH", name: "Agente de Saúde Organizacional", provider: "CLAUDE", model: "claude-opus-4-8" },
      { type: "EXECUTIVE", name: "Agente Executivo", provider: "CLAUDE", model: "claude-opus-4-8" },
    ],
  });

  const burnout = await prisma.riskCategory.create({ data: { code: "BURNOUT", name: "Burnout" } });
  const overload = await prisma.riskCategory.create({ data: { code: "OVERLOAD", name: "Sobrecarga" } });

  // Pesquisa com perguntas mapeadas a 2 riscos.
  const survey = await svc.createSurvey({ organizationId: org.id, title: "Saúde Emocional Q2", type: SurveyType.EMOTIONAL_HEALTH });
  const versionId = survey.versions[0].id;
  await svc.addQuestions(versionId, [
    { text: "Consigo me desconectar do trabalho.", type: QuestionType.LIKERT_5, riskCategoryId: burnout.id },
    { text: "Minha carga é compatível com a jornada.", type: QuestionType.LIKERT_5, riskCategoryId: overload.id },
  ]);
  await svc.publishVersion(versionId);

  const v = await prisma.surveyVersion.findUniqueOrThrow({ where: { id: versionId }, include: { questions: true } });
  const [qBurnout, qOverload] = v.questions;
  const data = [
    [1, 2], [2, 1], [1, 1], [2, 2], [1, 2],
  ];
  for (const [b, o] of data) {
    await svc.submitResponse({
      surveyId: survey.id,
      answers: [
        { questionId: qBurnout.id, valueNumber: b },
        { questionId: qOverload.id, valueNumber: o },
      ],
    });
  }

  // Série de engajamento com queda (72 → 54 = -25%).
  const now = Date.now();
  await prisma.indicatorSnapshot.createMany({
    data: [
      { organizationId: org.id, type: IndicatorType.ENGAGEMENT, value: 72, periodStart: new Date(now - 14 * 864e5), periodEnd: new Date(now - 7 * 864e5) },
      { organizationId: org.id, type: IndicatorType.ENGAGEMENT, value: 54, periodStart: new Date(now - 7 * 864e5), periodEnd: new Date(now) },
    ],
  });

  line();
  // 1) Rotular sentimento das respostas
  const labeled = await svc.labelSurveySentiments(org.id);
  console.log(`🏷️  Sentimento rotulado em ${labeled} respostas`);
  const labels = await prisma.surveyResponse.groupBy({ by: ["sentimentLabel"], where: { survey: { organizationId: org.id } }, _count: true });
  console.log("   distribuição:", Object.fromEntries(labels.map((l) => [l.sentimentLabel, l._count])));

  // 2) Agente de Saúde Organizacional → insights
  line();
  const insights = await svc.runOrgHealthAgent(org.id);
  console.log(`🧠 Agente de Saúde Organizacional gerou ${insights.length} insights:`);
  for (const i of insights) console.log(`   • [${i.type}/${i.severity}] ${i.summary}`);

  // 3) Agente Executivo → resumo
  line();
  const summary = await svc.runExecutiveAgent(org.id);
  console.log(`📝 Resumo executivo (${summary.cadence}):`);
  console.log(summary.content.split("\n").map((l) => "   " + l).join("\n"));
  console.log("   highlights:", JSON.stringify(summary.highlights));

  // --- Validação ---
  line();
  const hasTrend = insights.some((i) => i.type === "TREND" && i.severity === "HIGH");
  const hasRisk = insights.some((i) => i.type === "RISK_DETECTION");
  const ok = labeled === 5 && hasRisk && hasTrend && summary.content.length > 0;
  console.log(ok ? "✅ WORKER DE IA VALIDADO" : "❌ Algo divergiu — revisar");
  if (!ok) process.exitCode = 1;

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

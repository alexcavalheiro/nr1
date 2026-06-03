import { PrismaClient, RiskCode } from "@prisma/client";
import { hashPassword } from "./auth-crypto";

// =============================================================================
// Seed programático reutilizado pelo bootstrap do app (ensureDb) — idempotente.
// =============================================================================

const RISK_CATEGORIES: { code: RiskCode; name: string }[] = [
  { code: "MORAL_HARASSMENT", name: "Assédio moral" },
  { code: "SEXUAL_HARASSMENT", name: "Assédio sexual" },
  { code: "OVERLOAD", name: "Sobrecarga" },
  { code: "BURNOUT", name: "Burnout" },
  { code: "EXCESSIVE_PRESSURE", name: "Pressão excessiva" },
  { code: "INTERPERSONAL_CONFLICT", name: "Conflitos interpessoais" },
  { code: "EXCESSIVE_HOURS", name: "Jornadas excessivas" },
  { code: "TOXIC_LEADERSHIP", name: "Liderança tóxica" },
  { code: "AGGRESSIVE_COMMUNICATION", name: "Comunicação agressiva" },
  { code: "LACK_OF_RECOGNITION", name: "Falta de reconhecimento" },
  { code: "PSYCHOLOGICAL_INSECURITY", name: "Insegurança psicológica" },
];

/** Dados de referência: categorias de risco, política LGPD, agentes de IA. */
export async function seedReference(prisma: PrismaClient) {
  for (const c of RISK_CATEGORIES) {
    await prisma.riskCategory.upsert({ where: { code: c.code }, update: { name: c.name }, create: c });
  }
  await prisma.consentPolicy.upsert({
    where: { purpose_version: { purpose: "PSYCHOSOCIAL_ASSESSMENT", version: "2026.1" } },
    update: {},
    create: {
      version: "2026.1",
      purpose: "PSYCHOSOCIAL_ASSESSMENT",
      title: "Consentimento para avaliação psicossocial (NR-1)",
      body: "Autorizo o tratamento dos meus dados para avaliação de riscos psicossociais (LGPD/NR-1).",
      effectiveAt: new Date("2026-01-01"),
    },
  });
  const agents: { type: "ORG_HEALTH" | "EXECUTIVE"; name: string }[] = [
    { type: "ORG_HEALTH", name: "Agente de Saúde Organizacional" },
    { type: "EXECUTIVE", name: "Agente Executivo" },
  ];
  for (const a of agents) {
    const exists = await prisma.aiAgent.findFirst({ where: { organizationId: null, type: a.type } });
    if (!exists) {
      await prisma.aiAgent.create({ data: { type: a.type, name: a.name, provider: "CLAUDE", model: "claude-opus-4-8" } });
    }
  }
}

/**
 * Tenant de demonstração + cenário realista, para o dashboard não nascer vazio.
 * Login: admin@acme.com / admin123
 */
export async function seedDemoTenant(prisma: PrismaClient) {
  const svc = await import("./index");

  const org = await prisma.organization.create({ data: { name: "Acme Indústria S.A." } });
  const user = await prisma.user.create({
    data: { email: "admin@acme.com", name: "Ana Gestora", passwordHash: hashPassword("admin123") },
  });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "COMPANY_ADMIN", jobTitle: "Gestora de RH" },
  });

  // Automação: risco crítico → alerta + plano + auditoria.
  await prisma.automationFlow.create({
    data: {
      organizationId: org.id,
      name: "Risco crítico → resposta imediata",
      triggerEvent: "CRITICAL_RISK_DETECTED",
      enabled: true,
      actions: {
        create: [
          { order: 0, type: "SEND_ALERT", config: { alertType: "CRITICAL_RISK", title: "Risco crítico detectado" } },
          { order: 1, type: "CREATE_ACTION_PLAN", config: {} },
          { order: 2, type: "WRITE_AUDIT_LOG", config: {} },
        ],
      },
    },
  });

  const burnout = await prisma.riskCategory.findUniqueOrThrow({ where: { code: "BURNOUT" } });
  const overload = await prisma.riskCategory.findUniqueOrThrow({ where: { code: "OVERLOAD" } });

  // Pesquisa → respostas baixas → derivação de riscos.
  const survey = await svc.createSurvey({ organizationId: org.id, title: "Pesquisa de Clima Q2/2026", type: "CLIMATE" });
  const versionId = survey.versions[0].id;
  await svc.addQuestions(versionId, [
    { text: "Consigo descansar fora do trabalho.", type: "LIKERT_5", riskCategoryId: burnout.id },
    { text: "Minha carga de trabalho é sustentável.", type: "LIKERT_5", riskCategoryId: overload.id },
  ]);
  await svc.publishVersion(versionId);
  const v = await prisma.surveyVersion.findUniqueOrThrow({ where: { id: versionId }, include: { questions: true } });
  for (const [b, o] of [[1, 2], [2, 1], [1, 1], [2, 2], [1, 2]]) {
    await svc.submitResponse({
      surveyId: survey.id,
      answers: [
        { questionId: v.questions[0].id, valueNumber: b },
        { questionId: v.questions[1].id, valueNumber: o },
      ],
    });
  }
  await svc.labelSurveySentiments(org.id);
  const derived = await svc.deriveRisksFromSurvey(survey.id, { threshold: 2.5 });

  // Avalia o primeiro risco como CRÍTICO (dispara a automação) e prioriza.
  if (derived[0]) {
    await svc.assessRisk({ riskId: derived[0].riskId, probability: 5, impact: 5 });
    await svc.prioritizeRisk({ riskId: derived[0].riskId, severity: 5, frequency: 4, financialImpact: 3, humanImpact: 5, legalImpact: 5 });
  }

  // Engajamento em queda + insights de IA.
  const now = Date.now();
  await prisma.indicatorSnapshot.createMany({
    data: [
      { organizationId: org.id, type: "ENGAGEMENT", value: 72, periodStart: new Date(now - 14 * 864e5), periodEnd: new Date(now - 7 * 864e5) },
      { organizationId: org.id, type: "ENGAGEMENT", value: 54, periodStart: new Date(now - 7 * 864e5), periodEnd: new Date(now) },
    ],
  });
  await svc.runOrgHealthAgent(org.id);
  await svc.runExecutiveAgent(org.id);
}

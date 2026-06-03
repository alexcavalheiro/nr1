import { RiskStatus, SurveyStatus, SystemEventType, VersionStatus } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// SERVIÇO DE PESQUISAS — Módulo 2 (identificação). Ciclo:
//   criar Survey (+ versão rascunho) → adicionar perguntas → publicar versão
//   → coletar respostas → DERIVAR riscos (gera Risk + RiskSource rastreável).
// =============================================================================

export interface CreateSurveyInput {
  organizationId: string;
  title: string;
  type: import("@prisma/client").SurveyType;
  description?: string;
  anonymous?: boolean;
}

/** Cria a pesquisa já com a versão 1 em rascunho. */
export async function createSurvey(input: CreateSurveyInput) {
  return prisma.survey.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      type: input.type,
      description: input.description,
      anonymous: input.anonymous ?? true,
      versions: { create: { version: 1, status: VersionStatus.DRAFT } },
    },
    include: { versions: true },
  });
}

export interface QuestionInput {
  text: string;
  type: import("@prisma/client").QuestionType;
  riskCategoryId?: string; // liga a pergunta a um risco psicossocial
  required?: boolean;
  options?: unknown;
}

/** Adiciona perguntas a uma versão em rascunho (ordem automática). */
export async function addQuestions(surveyVersionId: string, questions: QuestionInput[]) {
  const version = await prisma.surveyVersion.findUniqueOrThrow({ where: { id: surveyVersionId } });
  if (version.status !== VersionStatus.DRAFT) {
    throw new Error("Só é possível editar perguntas de uma versão em rascunho.");
  }
  await prisma.surveyQuestion.createMany({
    data: questions.map((q, idx) => ({
      surveyVersionId,
      text: q.text,
      type: q.type,
      riskCategoryId: q.riskCategoryId,
      required: q.required ?? true,
      options: q.options as never,
      order: idx,
    })),
  });
  return prisma.surveyVersion.findUniqueOrThrow({
    where: { id: surveyVersionId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
}

/**
 * Publica a versão: congela a estrutura, marca como vigente no Survey, abre a
 * pesquisa e emite NEW_SURVEY (consumível por automações/webhooks).
 */
export async function publishVersion(surveyVersionId: string) {
  const version = await prisma.surveyVersion.findUniqueOrThrow({ where: { id: surveyVersionId } });
  const survey = await prisma.$transaction(async (tx) => {
    await tx.surveyVersion.update({
      where: { id: surveyVersionId },
      data: { status: VersionStatus.PUBLISHED, publishedAt: new Date() },
    });
    return tx.survey.update({
      where: { id: version.surveyId },
      data: { currentVersionId: surveyVersionId, status: SurveyStatus.OPEN },
    });
  });

  const { emitEvent } = await import("./events");
  await emitEvent({
    organizationId: survey.organizationId,
    type: SystemEventType.NEW_SURVEY,
    entityType: "Survey",
    entityId: survey.id,
    payload: { surveyId: survey.id, title: survey.title },
  });
  return survey;
}

export interface AnswerInput {
  questionId: string;
  valueNumber?: number;
  valueText?: string;
  valueOption?: string;
}

/** Registra uma resposta na versão vigente da pesquisa. */
export async function submitResponse(input: {
  surveyId: string;
  userId?: string;
  departmentId?: string;
  answers: AnswerInput[];
}) {
  const survey = await prisma.survey.findUniqueOrThrow({ where: { id: input.surveyId } });
  if (!survey.currentVersionId) throw new Error("Pesquisa não possui versão publicada.");

  return prisma.surveyResponse.create({
    data: {
      surveyId: survey.id,
      surveyVersionId: survey.currentVersionId,
      userId: survey.anonymous ? null : input.userId,
      departmentId: input.departmentId,
      answers: {
        create: input.answers.map((a) => ({
          questionId: a.questionId,
          valueNumber: a.valueNumber,
          valueText: a.valueText,
          valueOption: a.valueOption,
        })),
      },
    },
  });
}

// -----------------------------------------------------------------------------
// LEITURA p/ UI (escopado por tenant).
// -----------------------------------------------------------------------------
export async function listSurveys(organizationId: string) {
  return prisma.survey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { responses: true } },
      currentVersion: { select: { version: true } },
    },
  });
}

export async function getSurveyDetail(organizationId: string, surveyId: string) {
  return prisma.survey.findFirst({
    where: { id: surveyId, organizationId },
    include: {
      _count: { select: { responses: true } },
      versions: {
        orderBy: { version: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { riskCategory: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export async function getSurveyForResponse(organizationId: string, surveyId: string) {
  return prisma.survey.findFirst({
    where: { id: surveyId, organizationId },
    include: { currentVersion: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
}

// -----------------------------------------------------------------------------
// DERIVAÇÃO DE RISCOS — onde o Módulo 2 alimenta o inventário (Risk + RiskSource).
// Heurística: perguntas Likert ligadas a um RiskCategory cuja MÉDIA fica abaixo
// do limiar sinalizam risco. Convenção: escala 1..5 onde MAIOR = melhor clima,
// logo média BAIXA = sinal de risco. Gera 1 Risk por categoria sinalizada.
// -----------------------------------------------------------------------------
export async function deriveRisksFromSurvey(surveyId: string, opts: { threshold?: number } = {}) {
  const threshold = opts.threshold ?? 2.5;
  const survey = await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } });
  if (!survey.currentVersionId) throw new Error("Pesquisa sem versão publicada.");

  // Perguntas da versão vigente que estão mapeadas a um risco.
  const questions = await prisma.surveyQuestion.findMany({
    where: { surveyVersionId: survey.currentVersionId, riskCategoryId: { not: null } },
    include: { riskCategory: true },
  });
  if (!questions.length) return [];

  // Média das notas por categoria de risco.
  const agg = new Map<string, { sum: number; n: number; categoryId: string; categoryName: string }>();
  for (const q of questions) {
    const stats = await prisma.surveyAnswer.aggregate({
      where: { questionId: q.id, valueNumber: { not: null } },
      _sum: { valueNumber: true },
      _count: { valueNumber: true },
    });
    const sum = stats._sum.valueNumber ?? 0;
    const n = stats._count.valueNumber;
    if (!n) continue;
    const key = q.riskCategoryId!;
    const cur = agg.get(key) ?? { sum: 0, n: 0, categoryId: key, categoryName: q.riskCategory!.name };
    cur.sum += sum;
    cur.n += n;
    agg.set(key, cur);
  }

  const { createRisk } = await import("./risk.service");
  const created: { riskId: string; category: string; average: number }[] = [];

  for (const { sum, n, categoryId, categoryName } of agg.values()) {
    const avg = sum / n;
    if (avg > threshold) continue; // sem sinal de risco

    // Evita duplicar: reusa risco aberto da mesma categoria/origem se existir.
    const existing = await prisma.risk.findFirst({
      where: { organizationId: survey.organizationId, categoryId, status: { not: RiskStatus.CLOSED } },
    });
    const risk =
      existing ??
      (await createRisk({
        organizationId: survey.organizationId,
        categoryId,
        title: `${categoryName} (pesquisa: ${survey.title})`,
        source: `Pesquisa "${survey.title}" — média ${avg.toFixed(2)}`,
      }));

    // Rastreabilidade: registra a pesquisa como fonte do risco.
    await prisma.riskSource.create({
      data: {
        riskId: risk.id,
        type: "SURVEY",
        surveyId: survey.id,
        description: `Média ${avg.toFixed(2)} (limiar ${threshold}) em ${n} respostas.`,
      },
    });
    created.push({ riskId: risk.id, category: categoryName, average: Math.round(avg * 100) / 100 });
  }

  return created;
}

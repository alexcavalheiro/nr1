"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import {
  addQuestions,
  createSurvey,
  deleteSurvey,
  deriveRisksFromSurvey,
  getSurveyForResponse,
  publishVersion,
  requirePermission,
  submitResponse,
  updateSurvey,
  writeAudit,
} from "@/src/index";
import type { QuestionType, SurveyType } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(action = "edit"): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para esta ação.");
  await requirePermission(session, "avaliacoes", action);
  return session;
}

async function assertSurvey(surveyId: string, organizationId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, organizationId } });
  if (!survey) throw new Error("Pesquisa não encontrada.");
  return survey;
}

export async function createSurveyAction(formData: FormData) {
  const s = await guardManage("create");
  const title = str(formData, "title");
  if (!title) throw new Error("Título obrigatório.");
  const survey = await createSurvey({
    organizationId: s.organizationId,
    title,
    type: str(formData, "type") as SurveyType,
  });
  redirect(`/surveys/${survey.id}`);
}

export async function updateSurveyAction(formData: FormData) {
  const s = await guardManage();
  const surveyId = str(formData, "surveyId");
  await updateSurvey(surveyId, s.organizationId, {
    title: str(formData, "title"),
    type: (str(formData, "type") as SurveyType) || undefined,
    description: str(formData, "description") || null,
  });
  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath("/surveys");
}

export async function deleteSurveyAction(formData: FormData) {
  const s = await guardManage("delete");
  const surveyId = str(formData, "surveyId");
  await deleteSurvey(surveyId, s.organizationId);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "survey.deleted", entityType: "Survey", entityId: surveyId });
  revalidatePath("/surveys");
  redirect("/surveys");
}

export async function addQuestionAction(formData: FormData) {
  const s = await guardManage();
  const surveyId = str(formData, "surveyId");
  await assertSurvey(surveyId, s.organizationId);
  const versionId = str(formData, "versionId");
  const text = str(formData, "text");
  if (!text) throw new Error("Texto da pergunta obrigatório.");
  await addQuestions(versionId, [
    {
      text,
      type: str(formData, "type") as QuestionType,
      riskCategoryId: str(formData, "riskCategoryId") || undefined,
    },
  ]);
  revalidatePath(`/surveys/${surveyId}`);
}

export async function publishSurveyAction(formData: FormData) {
  const s = await guardManage();
  const surveyId = str(formData, "surveyId");
  await assertSurvey(surveyId, s.organizationId);
  await publishVersion(str(formData, "versionId"));
  revalidatePath(`/surveys/${surveyId}`);
}

export async function deriveRisksAction(formData: FormData) {
  const s = await guardManage();
  const surveyId = str(formData, "surveyId");
  await assertSurvey(surveyId, s.organizationId);
  await deriveRisksFromSurvey(surveyId);
  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

// Responder NÃO exige canManage (colaboradores respondem) — só sessão + tenant.
export async function submitResponseAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const surveyId = str(formData, "surveyId");
  const survey = await getSurveyForResponse(session.organizationId, surveyId);
  if (!survey?.currentVersion) throw new Error("Pesquisa indisponível para resposta.");

  const answers = survey.currentVersion.questions.map((q) => {
    const raw = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (q.type === "OPEN_TEXT") return { questionId: q.id, valueText: raw };
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") return { questionId: q.id, valueOption: raw };
    return { questionId: q.id, valueNumber: raw === "" ? undefined : Number(raw) };
  });

  await submitResponse({ surveyId, userId: session.userId, answers });
  redirect(`/surveys/${surveyId}?responded=1`);
}

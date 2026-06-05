"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import {
  addActionComment,
  addActionEvidence,
  advanceActionPlan,
  assessRisk,
  createActionPlan,
  createRisk,
  deleteRisk,
  prioritizeRisk,
  updateRisk,
  writeAudit,
} from "@/src/index";
import type { RiskStatus } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

/** Exige sessão + permissão de gestão. Usada por toda ação de escrita. */
async function guard(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para esta ação.");
  return session;
}

/** Garante que o risco pertence ao tenant da sessão (isolamento multi-tenant). */
async function assertRisk(riskId: string, organizationId: string) {
  const risk = await prisma.risk.findFirst({ where: { id: riskId, organizationId } });
  if (!risk) throw new Error("Risco não encontrado.");
  return risk;
}

const num = (fd: FormData, k: string) => Number(fd.get(k));
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createRiskAction(formData: FormData) {
  const s = await guard();
  const title = str(formData, "title");
  const categoryId = str(formData, "categoryId");
  if (!title || !categoryId) throw new Error("Título e categoria são obrigatórios.");
  await createRisk({
    organizationId: s.organizationId,
    categoryId,
    title,
    departmentId: str(formData, "departmentId") || undefined,
  });
  revalidatePath("/risks");
}

export async function updateRiskAction(formData: FormData) {
  const s = await guard();
  const riskId = str(formData, "riskId");
  await updateRisk(riskId, s.organizationId, {
    title: str(formData, "title"),
    categoryId: str(formData, "categoryId") || undefined,
    departmentId: str(formData, "departmentId") || null,
    description: str(formData, "description") || null,
    status: (str(formData, "status") as RiskStatus) || undefined,
  });
  revalidatePath(`/risks/${riskId}`);
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

export async function deleteRiskAction(formData: FormData) {
  const s = await guard();
  const riskId = str(formData, "riskId");
  await deleteRisk(riskId, s.organizationId);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "risk.deleted", entityType: "Risk", entityId: riskId });
  revalidatePath("/risks");
  revalidatePath("/dashboard");
  redirect("/risks");
}

export async function assessAction(formData: FormData) {
  const s = await guard();
  const riskId = str(formData, "riskId");
  await assertRisk(riskId, s.organizationId);
  await assessRisk({ riskId, probability: num(formData, "probability"), impact: num(formData, "impact") });
  revalidatePath(`/risks/${riskId}`);
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

export async function prioritizeAction(formData: FormData) {
  const s = await guard();
  const riskId = str(formData, "riskId");
  await assertRisk(riskId, s.organizationId);
  await prioritizeRisk({
    riskId,
    severity: num(formData, "severity"),
    frequency: num(formData, "frequency"),
    financialImpact: num(formData, "financialImpact"),
    humanImpact: num(formData, "humanImpact"),
    legalImpact: num(formData, "legalImpact"),
  });
  revalidatePath(`/risks/${riskId}`);
  revalidatePath("/dashboard");
}

export async function createPlanAction(formData: FormData) {
  const s = await guard();
  const riskId = str(formData, "riskId");
  await assertRisk(riskId, s.organizationId);
  const due = str(formData, "dueDate");
  await createActionPlan({
    organizationId: s.organizationId,
    riskId,
    title: str(formData, "title") || "Plano de ação",
    dueDate: due ? new Date(due) : undefined,
  });
  revalidatePath(`/risks/${riskId}`);
}

async function assertPlan(planId: string, organizationId: string) {
  const plan = await prisma.actionPlan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) throw new Error("Plano não encontrado.");
  return plan;
}

export async function advancePlanAction(formData: FormData) {
  const s = await guard();
  const planId = str(formData, "planId");
  await assertPlan(planId, s.organizationId);
  await advanceActionPlan(planId);
  revalidatePath(`/risks/${str(formData, "riskId")}`);
}

export async function commentAction(formData: FormData) {
  const s = await guard();
  const planId = str(formData, "planId");
  await assertPlan(planId, s.organizationId);
  const body = str(formData, "body");
  if (body) await addActionComment(planId, s.userId, body);
  revalidatePath(`/risks/${str(formData, "riskId")}`);
}

export async function evidenceAction(formData: FormData) {
  const s = await guard();
  const planId = str(formData, "planId");
  await assertPlan(planId, s.organizationId);
  const fileUrl = str(formData, "fileUrl");
  if (fileUrl) await addActionEvidence(planId, fileUrl, str(formData, "description") || undefined, s.userId);
  revalidatePath(`/risks/${str(formData, "riskId")}`);
}

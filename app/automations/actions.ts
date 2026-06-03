"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { addAction, createFlow, removeAction, toggleFlow } from "@/src/index";
import type { AutomationActionType, SystemEventType } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão.");
  return session;
}

async function assertFlow(id: string, organizationId: string) {
  const flow = await prisma.automationFlow.findFirst({ where: { id, organizationId } });
  if (!flow) throw new Error("Fluxo não encontrado.");
  return flow;
}

export async function createFlowAction(formData: FormData) {
  const s = await guardManage();
  const name = str(formData, "name");
  if (!name) throw new Error("Nome obrigatório.");
  const flow = await createFlow(s.organizationId, name, str(formData, "triggerEvent") as SystemEventType);
  redirect(`/automations/${flow.id}`);
}

export async function addActionAction(formData: FormData) {
  const s = await guardManage();
  const flowId = str(formData, "flowId");
  await assertFlow(flowId, s.organizationId);
  await addAction(flowId, str(formData, "type") as AutomationActionType, str(formData, "title") || undefined);
  revalidatePath(`/automations/${flowId}`);
}

export async function removeActionAction(formData: FormData) {
  const s = await guardManage();
  const flowId = str(formData, "flowId");
  await assertFlow(flowId, s.organizationId);
  await removeAction(str(formData, "actionId"));
  revalidatePath(`/automations/${flowId}`);
}

export async function toggleFlowAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertFlow(id, s.organizationId);
  await toggleFlow(id, str(formData, "enabled") === "true");
  revalidatePath(`/automations/${id}`);
  revalidatePath("/automations");
}

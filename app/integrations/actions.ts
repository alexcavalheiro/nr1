"use server";

import { revalidatePath } from "next/cache";
import { ensureDb, prisma } from "@/src/db";
import { connectIntegration, createWebhook, deleteWebhook, disconnectIntegration } from "@/src/index";
import type { IntegrationProvider, SystemEventType } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão.");
  return session;
}

export async function connectAction(formData: FormData) {
  const s = await guardManage();
  await connectIntegration(s.organizationId, str(formData, "provider") as IntegrationProvider, str(formData, "token") || undefined);
  revalidatePath("/integrations");
}

export async function disconnectAction(formData: FormData) {
  const s = await guardManage();
  await disconnectIntegration(s.organizationId, str(formData, "provider") as IntegrationProvider);
  revalidatePath("/integrations");
}

export async function createWebhookAction(formData: FormData) {
  const s = await guardManage();
  const url = str(formData, "url");
  if (!url) throw new Error("URL obrigatória.");
  const events = formData.getAll("events").map(String) as SystemEventType[];
  await createWebhook(s.organizationId, url, events.length ? events : (["NEW_RISK"] as SystemEventType[]));
  revalidatePath("/integrations");
}

export async function deleteWebhookAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  const wh = await prisma.webhookEndpoint.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!wh) throw new Error("Webhook não encontrado.");
  await deleteWebhook(id);
  revalidatePath("/integrations");
}

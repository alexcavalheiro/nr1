"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import {
  assignManifestation,
  createManifestation,
  createRiskFromManifestation,
  requirePermission,
  updateManifestationStatus,
} from "@/src/index";
import type { ManifestationStatus, ManifestationType } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(action = "edit"): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para esta ação.");
  await requirePermission(session, "escuta", action);
  return session;
}

async function assertManifestation(id: string, organizationId: string) {
  const m = await prisma.manifestation.findFirst({ where: { id, organizationId } });
  if (!m) throw new Error("Manifestação não encontrada.");
  return m;
}

// Registrar manifestação: aberto a qualquer usuário logado (canal de escuta).
export async function createManifestationAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const body = str(formData, "body");
  if (!body) throw new Error("Descreva a manifestação.");
  const anonymous = formData.get("anonymous") != null;
  await createManifestation({
    organizationId: session.organizationId,
    type: str(formData, "type") as ManifestationType,
    subject: str(formData, "subject") || undefined,
    body,
    anonymous,
    authorId: session.userId,
  });
  redirect("/listening?sent=1");
}

export async function updateStatusAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertManifestation(id, s.organizationId);
  await updateManifestationStatus(id, str(formData, "status") as ManifestationStatus);
  revalidatePath(`/listening/${id}`);
  revalidatePath("/listening");
}

export async function assignToMeAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertManifestation(id, s.organizationId);
  await assignManifestation(id, s.userId);
  revalidatePath(`/listening/${id}`);
}

export async function createRiskFromManifestationAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertManifestation(id, s.organizationId);
  await createRiskFromManifestation(s.organizationId, id, str(formData, "categoryId"));
  revalidatePath(`/listening/${id}`);
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

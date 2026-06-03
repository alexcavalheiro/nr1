"use server";

import { revalidatePath } from "next/cache";
import { ensureDb, prisma } from "@/src/db";
import { recordIndicator, resolveAlert, runMonitoringChecks } from "@/src/index";
import type { IndicatorType } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para esta ação.");
  return session;
}

export async function recordIndicatorAction(formData: FormData) {
  const s = await guardManage();
  const value = Number(str(formData, "value"));
  if (Number.isNaN(value)) throw new Error("Valor inválido.");
  const dateStr = str(formData, "periodEnd");
  await recordIndicator({
    organizationId: s.organizationId,
    type: str(formData, "type") as IndicatorType,
    value,
    periodEnd: dateStr ? new Date(dateStr) : undefined,
  });
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
}

export async function runChecksAction() {
  const s = await guardManage();
  await runMonitoringChecks(s.organizationId);
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
}

export async function resolveAlertAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  const alert = await prisma.alert.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!alert) throw new Error("Alerta não encontrado.");
  await resolveAlert(id);
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
}

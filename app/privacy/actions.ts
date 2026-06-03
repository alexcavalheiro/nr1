"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ensureDb, prisma } from "@/src/db";
import { createDataRequest, grantConsent, revokeConsent, setDataRequestStatus } from "@/src/index";
import type { ConsentPurpose, DataRequestStatus, DataRequestType } from "@prisma/client";
import { canManage, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function grantConsentAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const h = await headers();
  await grantConsent(session.userId, session.organizationId, str(formData, "policyId"), str(formData, "purpose") as ConsentPurpose, {
    ip: h.get("x-forwarded-for") ?? undefined,
    ua: h.get("user-agent") ?? undefined,
  });
  revalidatePath("/privacy");
}

export async function revokeConsentAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  await revokeConsent(session.userId, str(formData, "consentId"));
  revalidatePath("/privacy");
}

export async function createDataRequestAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  await createDataRequest(session.userId, session.organizationId, str(formData, "type") as DataRequestType, str(formData, "details") || undefined);
  revalidatePath("/privacy");
}

export async function updateRequestStatusAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão.");
  const id = str(formData, "id");
  const req = await prisma.dataSubjectRequest.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!req) throw new Error("Solicitação não encontrada.");
  await setDataRequestStatus(id, str(formData, "status") as DataRequestStatus);
  revalidatePath("/privacy");
}

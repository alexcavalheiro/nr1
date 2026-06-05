"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import {
  addManualDocument,
  buildNr1Report,
  deleteDocument,
  recordGeneratedDocument,
  requirePermission,
  updateManualDocument,
  writeAudit,
} from "@/src/index";
import { canManage, canViewDocs, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function generateReportAction() {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) throw new Error("Sem permissão.");
  const report = await buildNr1Report(session.organizationId);
  await recordGeneratedDocument(session.organizationId, "NR1_REPORT", "PDF", report, session.userId);
  await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "document.report_generated", entityType: "GeneratedDocument" });
  redirect("/documents/report");
}

async function guardManage(action = "edit") {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para gerir documentos.");
  await requirePermission(session, "documentos", action);
  return session;
}

export async function addDocumentAction(formData: FormData) {
  const session = await guardManage("create");
  await addManualDocument(
    session.organizationId,
    { title: str(formData, "title"), fileUrl: str(formData, "fileUrl") || undefined, note: str(formData, "note") || undefined },
    session.userId,
  );
  revalidatePath("/documents");
}

export async function updateDocumentAction(formData: FormData) {
  const session = await guardManage();
  await updateManualDocument(str(formData, "id"), session.organizationId, {
    title: str(formData, "title"),
    fileUrl: str(formData, "fileUrl") || undefined,
    note: str(formData, "note") || undefined,
  });
  revalidatePath("/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const session = await guardManage("delete");
  const id = str(formData, "id");
  await deleteDocument(id, session.organizationId);
  await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "document.deleted", entityType: "GeneratedDocument", entityId: id });
  revalidatePath("/documents");
}

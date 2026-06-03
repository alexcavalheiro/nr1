"use server";

import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { buildNr1Report, recordGeneratedDocument } from "@/src/index";
import { canViewDocs, requireSession } from "../lib/auth";

export async function generateReportAction() {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) throw new Error("Sem permissão.");
  const report = await buildNr1Report(session.organizationId);
  await recordGeneratedDocument(session.organizationId, "NR1_REPORT", "PDF", report, session.userId);
  redirect("/documents/report");
}

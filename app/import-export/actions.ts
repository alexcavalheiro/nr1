"use server";

import { revalidatePath } from "next/cache";
import { ensureDb } from "@/src/db";
import { validateWorkbook, type ImportReport } from "@/src/services/import-data";
import { commitImport, type CommitResult } from "@/src/services/import-commit";
import { writeAudit } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";

export interface ImportState {
  report?: ImportReport;
  result?: CommitResult;
  error?: string;
}

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) return { error: "Sem permissão para importar." };

  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "validate");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma planilha (.xlsx)." };
  if (!/\.(xlsx|xls)$/i.test(file.name)) return { error: "Formato inválido — use .xlsx ou .xls." };

  try {
    const buffer = await file.arrayBuffer();
    const report = await validateWorkbook(buffer);
    if (mode !== "commit") return { report };

    if (!report.ok && report.totalErrors > 0) {
      return { report, error: "Corrija as inconsistências antes de importar." };
    }
    const result = await commitImport(session.organizationId, buffer, { actorId: session.userId, fileName: file.name });
    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "import.committed",
      entityType: "ImportBatch",
      entityId: result.batchId,
      metadata: { fileName: file.name, created: result.created, updated: result.updated },
    });
    revalidatePath("/import-export");
    return { report, result };
  } catch (e) {
    return { error: `Falha ao processar a planilha: ${(e as Error).message}` };
  }
}

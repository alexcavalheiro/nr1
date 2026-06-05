"use server";

import { ensureDb } from "@/src/db";
import { validateWorkbook, type ImportReport } from "@/src/services/import-data";
import { canManage, requireSession } from "../lib/auth";

export interface ValidateState {
  report?: ImportReport;
  error?: string;
}

export async function validateImportAction(_prev: ValidateState, formData: FormData): Promise<ValidateState> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) return { error: "Sem permissão para importar." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma planilha (.xlsx)." };
  if (!/\.(xlsx|xls)$/i.test(file.name)) return { error: "Formato inválido — use .xlsx ou .xls." };

  try {
    const buffer = await file.arrayBuffer();
    const report = await validateWorkbook(buffer);
    return { report };
  } catch (e) {
    return { error: `Não foi possível ler a planilha: ${(e as Error).message}` };
  }
}

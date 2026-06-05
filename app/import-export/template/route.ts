import { ensureDb } from "@/src/db";
import { buildTemplateWorkbook } from "@/src/services/import-data";
import { canManage, getSession } from "../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /import-export/template — baixa o modelo de importação (.xlsx, 6 abas).
export async function GET() {
  await ensureDb();
  const session = await getSession();
  if (!session || !canManage(session.role)) {
    return new Response("Não autorizado", { status: 403 });
  }
  const wb = await buildTemplateWorkbook();
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="modelo-importacao-nr1.xlsx"',
    },
  });
}

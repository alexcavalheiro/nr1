"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { createCompany, deleteCompany, requirePermission, updateCompany, writeAudit } from "@/src/index";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(action: string): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para gerir empresas.");
  await requirePermission(session, "empresas", action);
  return session;
}

function fields(fd: FormData) {
  return {
    razaoSocial: str(fd, "razaoSocial"),
    nomeFantasia: str(fd, "nomeFantasia"),
    cnpj: str(fd, "cnpj"),
    inscricaoEstadual: str(fd, "inscricaoEstadual"),
    inscricaoMunicipal: str(fd, "inscricaoMunicipal"),
    endereco: str(fd, "endereco"),
    cidade: str(fd, "cidade"),
    estado: str(fd, "estado"),
    cep: str(fd, "cep"),
    telefone: str(fd, "telefone"),
    email: str(fd, "email"),
    status: str(fd, "status"),
    observacoes: str(fd, "observacoes"),
  };
}

export async function createCompanyAction(formData: FormData) {
  const s = await guard("create");
  try {
    const c = await createCompany(s.organizationId, fields(formData));
    await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "company.created", entityType: "Company", entityId: c.id, metadata: { razaoSocial: c.razaoSocial } });
  } catch (e) {
    redirect(`/empresas?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/empresas");
  redirect("/empresas?ok=1");
}

export async function updateCompanyAction(formData: FormData) {
  const s = await guard("edit");
  const id = str(formData, "id");
  try {
    await updateCompany(s.organizationId, id, fields(formData));
    await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "company.updated", entityType: "Company", entityId: id });
  } catch (e) {
    redirect(`/empresas/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${id}`);
  redirect(`/empresas/${id}?ok=1`);
}

export async function deleteCompanyAction(formData: FormData) {
  const s = await guard("delete");
  const id = str(formData, "id");
  await deleteCompany(s.organizationId, id);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "company.deleted", entityType: "Company", entityId: id });
  revalidatePath("/empresas");
  redirect("/empresas?deleted=1");
}

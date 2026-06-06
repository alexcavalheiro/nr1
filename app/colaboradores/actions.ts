"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { createEmployee, deleteEmployee, requirePermission, updateEmployee, writeAudit } from "@/src/index";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(action: string): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para gerir colaboradores.");
  await requirePermission(session, "colaboradores", action);
  return session;
}

function fields(fd: FormData) {
  return {
    name: str(fd, "name"),
    cpf: str(fd, "cpf"),
    email: str(fd, "email"),
    jobTitle: str(fd, "jobTitle"),
    phone: str(fd, "phone"),
    status: str(fd, "status"),
    observacoes: str(fd, "observacoes"),
    companyId: str(fd, "companyId"),
    departmentId: str(fd, "departmentId"),
    userId: str(fd, "userId"),
    admissionDate: str(fd, "admissionDate"),
  };
}

export async function createEmployeeAction(formData: FormData) {
  const s = await guard("create");
  try {
    const e = await createEmployee(s.organizationId, fields(formData));
    await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "employee.created", entityType: "Employee", entityId: e.id, metadata: { name: e.name } });
  } catch (e) {
    redirect(`/colaboradores?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/colaboradores");
  redirect("/colaboradores?ok=1");
}

export async function updateEmployeeAction(formData: FormData) {
  const s = await guard("edit");
  const id = str(formData, "id");
  try {
    await updateEmployee(s.organizationId, id, fields(formData));
    await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "employee.updated", entityType: "Employee", entityId: id });
  } catch (e) {
    redirect(`/colaboradores/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
  redirect(`/colaboradores/${id}?ok=1`);
}

export async function deleteEmployeeAction(formData: FormData) {
  const s = await guard("delete");
  const id = str(formData, "id");
  await deleteEmployee(s.organizationId, id);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "employee.deleted", entityType: "Employee", entityId: id });
  revalidatePath("/colaboradores");
  redirect("/colaboradores?deleted=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { createMember, requirePermission, resetMemberPassword, setMemberActive, updateMemberProfile, updateMemberRole, writeAudit } from "@/src/index";
import type { Role } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para gerir usuários.");
  return session;
}

async function assertMembership(id: string, organizationId: string) {
  const m = await prisma.membership.findFirst({ where: { id, organizationId } });
  if (!m) throw new Error("Membro não encontrado.");
  return m;
}

export async function createMemberAction(formData: FormData) {
  const s = await guardManage();
  await requirePermission(s, "usuarios", "create");
  const name = str(formData, "name");
  const email = str(formData, "email");
  if (!name || !email) throw new Error("Nome e e-mail são obrigatórios.");
  await createMember({
    organizationId: s.organizationId,
    name,
    email,
    role: str(formData, "role") as Role,
    jobTitle: str(formData, "jobTitle") || undefined,
    password: str(formData, "password") || "nr1@2026",
  });
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "user.created", entityType: "User", metadata: { name, email, role: str(formData, "role") } });
  revalidatePath("/users");
}

export async function updateMemberAction(formData: FormData) {
  const s = await guardManage();
  await requirePermission(s, "usuarios", "edit");
  const id = str(formData, "id");
  try {
    await updateMemberProfile(id, s.organizationId, {
      name: str(formData, "name"),
      email: str(formData, "email"),
      jobTitle: str(formData, "jobTitle") || undefined,
    });
  } catch (e) {
    redirect(`/users/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "user.updated", entityType: "Membership", entityId: id, metadata: { name: str(formData, "name"), email: str(formData, "email") } });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  redirect(`/users/${id}?ok=1`);
}

export async function changeRoleAction(formData: FormData) {
  const s = await guardManage();
  await requirePermission(s, "usuarios", "edit");
  const id = str(formData, "id");
  await assertMembership(id, s.organizationId);
  const role = str(formData, "role") as Role;
  await updateMemberRole(id, role);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "user.role_changed", entityType: "Membership", entityId: id, metadata: { role } });
  revalidatePath("/users");
}

export async function toggleActiveAction(formData: FormData) {
  const s = await guardManage();
  await requirePermission(s, "usuarios", "edit");
  const id = str(formData, "id");
  await assertMembership(id, s.organizationId);
  const active = str(formData, "active") === "true";
  await setMemberActive(id, active);
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: active ? "user.activated" : "user.deactivated", entityType: "Membership", entityId: id });
  revalidatePath("/users");
}

export async function resetPasswordAction(formData: FormData) {
  const s = await guardManage();
  await requirePermission(s, "usuarios", "edit");
  const id = str(formData, "id");
  // Volta para o detalhe do membro quando acionado de lá; senão para a lista.
  const base = str(formData, "from") === "detail" ? `/users/${id}` : "/users";
  try {
    await resetMemberPassword(id, s.organizationId, str(formData, "password"));
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent((e as Error).message)}`);
  }
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "user.password_reset", entityType: "Membership", entityId: id });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  redirect(`${base}?reset=1`);
}

"use server";

import { revalidatePath } from "next/cache";
import { ensureDb, prisma } from "@/src/db";
import { createMember, setMemberActive, updateMemberRole } from "@/src/index";
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
  revalidatePath("/users");
}

export async function changeRoleAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertMembership(id, s.organizationId);
  await updateMemberRole(id, str(formData, "role") as Role);
  revalidatePath("/users");
}

export async function toggleActiveAction(formData: FormData) {
  const s = await guardManage();
  const id = str(formData, "id");
  await assertMembership(id, s.organizationId);
  await setMemberActive(id, str(formData, "active") === "true");
  revalidatePath("/users");
}

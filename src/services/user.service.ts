import { Role } from "@prisma/client";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../auth-crypto";

const MIN_PASSWORD = 6;

function assertPassword(password: string) {
  if (!password || password.length < MIN_PASSWORD)
    throw new Error(`A nova senha deve ter ao menos ${MIN_PASSWORD} caracteres.`);
}

// =============================================================================
// GESTÃO DE USUÁRIOS / PERFIS — membros de uma organização (Membership) e seus
// papéis. Conta de usuário é global; o papel mora no vínculo com a empresa.
// =============================================================================

export async function listMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
}

export interface CreateMemberInput {
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  jobTitle?: string;
  password: string;
}

export async function createMember(input: CreateMemberInput) {
  const email = input.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: input.name, passwordHash: hashPassword(input.password) },
    });
  }
  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: input.organizationId } },
  });
  if (existing) throw new Error("Este usuário já é membro da organização.");
  return prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: input.organizationId,
      role: input.role,
      jobTitle: input.jobTitle,
      isLeader: input.role === Role.LEADER,
    },
  });
}

export async function updateMemberRole(membershipId: string, role: Role) {
  return prisma.membership.update({
    where: { id: membershipId },
    data: { role, isLeader: role === Role.LEADER },
  });
}

export async function setMemberActive(membershipId: string, active: boolean) {
  return prisma.membership.update({ where: { id: membershipId }, data: { active } });
}

/** Troca da própria senha: exige a senha atual correta. */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  assertPassword(newPassword);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado.");
  if (!verifyPassword(currentPassword, user.passwordHash)) throw new Error("Senha atual incorreta.");
  if (verifyPassword(newPassword, user.passwordHash)) throw new Error("A nova senha deve ser diferente da atual.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } });
}

/** Reset de senha por gestor: define nova senha de um membro da própria organização. */
export async function resetMemberPassword(membershipId: string, organizationId: string, newPassword: string) {
  assertPassword(newPassword);
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!membership) throw new Error("Membro não encontrado.");
  await prisma.user.update({ where: { id: membership.userId }, data: { passwordHash: hashPassword(newPassword) } });
}

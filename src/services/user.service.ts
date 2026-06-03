import { Role } from "@prisma/client";
import { prisma } from "../db";
import { hashPassword } from "../auth-crypto";

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

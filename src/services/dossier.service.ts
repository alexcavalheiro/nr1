import { prisma } from "../db";

// =============================================================================
// Dossiê do colaborador — consolida todo o histórico/movimentações dele dentro
// do programa, incluindo a empresa contratante. Usado para gerar PDF.
// =============================================================================

export async function employeeDossier(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: {
      company: true,
      department: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, twoFactorEnabled: true, createdAt: true } },
    },
  });
  if (!employee) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, legalName: true, cnpj: true },
  });

  const userId = employee.userId;

  // Movimentações vinculadas ao usuário de login (quando houver).
  const [membership, surveyResponses, manifestations, handled, learning, actionPlans, evidences, lastLogin] =
    userId
      ? await Promise.all([
          prisma.membership.findFirst({
            where: { userId, organizationId },
            include: { department: { select: { name: true } } },
          }),
          prisma.surveyResponse.findMany({
            where: { userId, survey: { organizationId } },
            include: { survey: { select: { title: true, type: true } } },
            orderBy: { submittedAt: "desc" },
          }),
          prisma.manifestation.findMany({
            where: { authorId: userId, organizationId },
            select: { id: true, subject: true, status: true, anonymous: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.manifestation.count({ where: { handlerId: userId, organizationId } }),
          prisma.contentProgress.findMany({
            where: { userId },
            include: { content: { select: { title: true } } },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.actionPlan.findMany({
            where: { ownerId: userId, organizationId },
            select: { id: true, title: true, status: true, dueDate: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.actionEvidence.findMany({
            where: { uploadedById: userId },
            select: { id: true, fileName: true, uploadedAt: true, actionPlan: { select: { title: true } } },
            orderBy: { uploadedAt: "desc" },
          }),
          prisma.auditLog.findFirst({
            where: { actorId: userId, action: "auth.login" },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ])
      : [null, [], [], 0, [], [], [], null];

  // Trilha de auditoria: tudo sobre o registro do colaborador e ações do usuário.
  const audit = await prisma.auditLog.findMany({
    where: {
      organizationId,
      OR: [
        { entityId: employeeId },
        ...(userId ? [{ actorId: userId }, { entityId: userId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return {
    organization,
    employee,
    access: membership
      ? {
          role: membership.role,
          jobTitle: membership.jobTitle,
          active: membership.active,
          accessExpiresAt: membership.accessExpiresAt,
          department: membership.department?.name ?? null,
          twoFactor: employee.user?.twoFactorEnabled ?? false,
          email: employee.user?.email ?? null,
          createdAt: employee.user?.createdAt ?? null,
          lastLoginAt: lastLogin?.createdAt ?? null,
        }
      : null,
    history: {
      surveyResponses,
      manifestations,
      handledCount: handled,
      learning,
      actionPlans,
      evidences,
    },
    audit,
    generatedAt: new Date(),
  };
}

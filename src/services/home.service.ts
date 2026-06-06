import { prisma } from "../db";

// =============================================================================
// Página inicial do colaborador — "o que preciso fazer".
// Pesquisas abertas para responder + trilhas de aprendizagem com progresso.
// =============================================================================

export async function collaboratorHome(organizationId: string, userId: string) {
  const open = await prisma.survey.findMany({
    where: { organizationId, status: "OPEN", currentVersionId: { not: null } },
    select: { id: true, title: true, type: true, anonymous: true, currentVersionId: true },
    orderBy: { createdAt: "desc" },
  });
  const answered = new Set(
    (
      await prisma.surveyResponse.findMany({
        where: { surveyId: { in: open.map((s) => s.id) }, userId },
        select: { surveyId: true },
      })
    ).map((r) => r.surveyId),
  );
  // Não-anônimas já respondidas saem da lista; anônimas permanecem (não dá p/ saber).
  const pendingSurveys = open.filter((s) => s.anonymous || !answered.has(s.id));

  const tracks = await prisma.learningTrack.findMany({
    where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      contents: { where: { published: true }, select: { progress: { where: { userId }, select: { status: true } } } },
    },
  });
  const learning = tracks.map((t) => {
    const total = t.contents.length;
    const done = t.contents.filter((c) => c.progress.some((p) => p.status === "COMPLETED")).length;
    return { id: t.id, title: t.title, total, done };
  });

  return { pendingSurveys, learning };
}

// =============================================================================
// Onboarding "primeiros passos" do gestor — checklist com base em dados reais.
// =============================================================================

export async function onboardingSteps(organizationId: string) {
  const [members, employees, surveys, risks] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId } }),
    prisma.survey.count({ where: { organizationId } }),
    prisma.risk.count({ where: { organizationId } }),
  ]);
  return [
    { key: "team", label: "Convidar a equipe (usuários)", href: "/users", done: members > 1 },
    { key: "employees", label: "Cadastrar colaboradores", href: "/colaboradores", done: employees > 0 },
    { key: "survey", label: "Criar a primeira pesquisa", href: "/surveys", done: surveys > 0 },
    { key: "risks", label: "Mapear riscos psicossociais", href: "/risks", done: risks > 0 },
  ];
}

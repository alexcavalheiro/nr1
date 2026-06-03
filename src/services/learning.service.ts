import { ContentType, LearningTheme } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// MÓDULO 1 — DESENVOLVIMENTO SOCIOEMOCIONAL. Trilhas de aprendizagem com
// conteúdos (vídeo, podcast, e-book, pílula) e progresso por colaborador.
// =============================================================================

export async function listTracks(organizationId: string, userId: string) {
  return prisma.learningTrack.findMany({
    where: { OR: [{ organizationId: null }, { organizationId }] },
    orderBy: { createdAt: "desc" },
    include: {
      contents: { orderBy: { order: "asc" }, include: { progress: { where: { userId }, select: { status: true } } } },
    },
  });
}

export async function createTrack(organizationId: string, title: string, theme: LearningTheme, description?: string) {
  return prisma.learningTrack.create({ data: { organizationId, title, theme, description, published: true } });
}

export async function addContent(trackId: string, title: string, type: ContentType, theme: LearningTheme, mediaUrl?: string) {
  const count = await prisma.learningContent.count({ where: { trackId } });
  return prisma.learningContent.create({
    data: { trackId, title, type, theme, mediaUrl, order: count, published: true },
  });
}

export async function markContentComplete(contentId: string, userId: string) {
  return prisma.contentProgress.upsert({
    where: { contentId_userId: { contentId, userId } },
    update: { status: "COMPLETED", progressPercent: 100, completedAt: new Date() },
    create: { contentId, userId, status: "COMPLETED", progressPercent: 100, startedAt: new Date(), completedAt: new Date() },
  });
}

import { ManifestationStatus, ManifestationType, SystemEventType } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// SERVIÇO DE ESCUTA ATIVA — canal de manifestações (denúncia, sugestão, pedido
// de ajuda, reconhecimento), com suporte a anonimato. Uma denúncia pode originar
// um risco no inventário (RiskSource type=MANIFESTATION → rastreabilidade).
// =============================================================================

export interface CreateManifestationInput {
  organizationId: string;
  type: ManifestationType;
  body: string;
  subject?: string;
  anonymous?: boolean;
  authorId?: string;
  departmentId?: string;
}

export async function createManifestation(input: CreateManifestationInput) {
  const m = await prisma.manifestation.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      body: input.body,
      subject: input.subject,
      anonymous: !!input.anonymous,
      authorId: input.anonymous ? null : input.authorId, // anonimato: não vincula autor
      departmentId: input.departmentId,
    },
  });

  const { emitEvent } = await import("./events");
  await emitEvent({
    organizationId: input.organizationId,
    type: SystemEventType.NEW_MANIFESTATION,
    entityType: "Manifestation",
    entityId: m.id,
    payload: { manifestationId: m.id, type: m.type },
  });
  return m;
}

export async function listManifestations(organizationId: string) {
  return prisma.manifestation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      handler: { select: { name: true } },
      _count: { select: { riskSources: true } },
    },
  });
}

export async function getManifestationDetail(organizationId: string, id: string) {
  return prisma.manifestation.findFirst({
    where: { id, organizationId },
    include: {
      author: { select: { name: true } },
      handler: { select: { name: true } },
      riskSources: { include: { risk: { select: { id: true, title: true } } } },
    },
  });
}

export async function updateManifestationStatus(id: string, status: ManifestationStatus) {
  return prisma.manifestation.update({ where: { id }, data: { status } });
}

export async function assignManifestation(id: string, handlerId: string) {
  return prisma.manifestation.update({
    where: { id },
    data: { handlerId, status: ManifestationStatus.IN_REVIEW },
  });
}

/** Origina um risco no inventário a partir de uma manifestação (rastreável). */
export async function createRiskFromManifestation(
  organizationId: string,
  manifestationId: string,
  categoryId: string,
) {
  const m = await prisma.manifestation.findFirstOrThrow({ where: { id: manifestationId, organizationId } });
  const { createRisk } = await import("./risk.service");
  const risk = await createRisk({
    organizationId,
    categoryId,
    title: `Manifestação (${m.type})${m.subject ? `: ${m.subject}` : ""}`,
    source: "Escuta ativa",
  });
  await prisma.riskSource.create({
    data: { riskId: risk.id, type: "MANIFESTATION", manifestationId: m.id, description: `Origem: manifestação ${m.type}.` },
  });
  await prisma.manifestation.update({ where: { id: m.id }, data: { status: ManifestationStatus.IN_REVIEW } });
  return risk;
}

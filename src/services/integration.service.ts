import { IntegrationProvider, IntegrationStatus, Prisma, SystemEventType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";

// =============================================================================
// CENTRAL DE INTEGRAÇÕES (Módulo 8) — conectores + endpoints de webhook.
// =============================================================================

export async function listIntegrations(organizationId: string) {
  return prisma.integration.findMany({ where: { organizationId }, orderBy: { provider: "asc" } });
}

export async function connectIntegration(
  organizationId: string,
  provider: IntegrationProvider,
  token?: string,
) {
  const existing = await prisma.integration.findFirst({ where: { organizationId, provider } });
  const data = {
    status: IntegrationStatus.CONNECTED,
    credentials: (token ? { token } : {}) as Prisma.InputJsonValue,
    lastSyncAt: new Date(),
  };
  if (existing) return prisma.integration.update({ where: { id: existing.id }, data });
  return prisma.integration.create({ data: { organizationId, provider, ...data } });
}

export async function disconnectIntegration(organizationId: string, provider: IntegrationProvider) {
  const existing = await prisma.integration.findFirst({ where: { organizationId, provider } });
  if (!existing) return null;
  return prisma.integration.update({ where: { id: existing.id }, data: { status: IntegrationStatus.DISCONNECTED } });
}

export async function listWebhooks(organizationId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });
}

export async function createWebhook(organizationId: string, url: string, events: SystemEventType[]) {
  return prisma.webhookEndpoint.create({
    data: { organizationId, url, events, secret: randomBytes(16).toString("hex") },
  });
}

export async function deleteWebhook(id: string) {
  return prisma.webhookEndpoint.delete({ where: { id } });
}

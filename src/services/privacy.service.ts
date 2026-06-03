import { ConsentPurpose, DataRequestStatus, DataRequestType } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// LGPD — consentimento versionado e direitos do titular (DSAR).
// =============================================================================

export async function getActivePolicies() {
  return prisma.consentPolicy.findMany({ where: { active: true }, orderBy: { effectiveAt: "desc" } });
}

export async function getMyConsents(userId: string) {
  return prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: "desc" } });
}

export async function grantConsent(userId: string, organizationId: string, policyId: string, purpose: ConsentPurpose, meta?: { ip?: string; ua?: string }) {
  return prisma.consent.create({
    data: { userId, organizationId, policyId, purpose, status: "GRANTED", ipAddress: meta?.ip, userAgent: meta?.ua },
  });
}

export async function revokeConsent(userId: string, consentId: string) {
  const consent = await prisma.consent.findFirst({ where: { id: consentId, userId } });
  if (!consent) throw new Error("Consentimento não encontrado.");
  return prisma.consent.update({ where: { id: consentId }, data: { status: "REVOKED", revokedAt: new Date() } });
}

export async function createDataRequest(userId: string, organizationId: string, type: DataRequestType, details?: string) {
  return prisma.dataSubjectRequest.create({
    data: { userId, organizationId, type, details, dueAt: new Date(Date.now() + 15 * 86_400_000) },
  });
}

export async function listMyDataRequests(userId: string) {
  return prisma.dataSubjectRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" } });
}

export async function listOrgDataRequests(organizationId: string) {
  return prisma.dataSubjectRequest.findMany({
    where: { organizationId },
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function setDataRequestStatus(id: string, status: DataRequestStatus) {
  return prisma.dataSubjectRequest.update({
    where: { id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
  });
}

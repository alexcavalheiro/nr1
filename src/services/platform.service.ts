import { prisma } from "../db";
import { hashPassword } from "../auth-crypto";

// =============================================================================
// PAINEL DO PROVEDOR (Super Admin) — gestão dos clientes (Organizations).
// Cada cliente é uma organização isolada (multi-tenant). Estas funções operam
// ACIMA do tenant: enxergam todas as organizações. Proteja sempre por
// role === "SUPER_ADMIN" na server action.
// =============================================================================

const PROVIDER_ORG_NAME = "Plataforma (Provedor)";

export async function listClients() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, employees: true, companies: true } },
    },
  });
  // Não lista a própria organização do provedor como "cliente".
  return orgs.filter((o) => o.name !== PROVIDER_ORG_NAME);
}

export async function platformStats() {
  const [clients, active, users, employees] = await Promise.all([
    prisma.organization.count({ where: { name: { not: PROVIDER_ORG_NAME } } }),
    prisma.organization.count({ where: { name: { not: PROVIDER_ORG_NAME }, active: true } }),
    prisma.membership.count(),
    prisma.employee.count(),
  ]);
  return { clients, active, suspended: clients - active, users, employees };
}

export interface NewClientInput {
  name: string;
  legalName?: string;
  cnpj?: string;
  industry?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

/** Cria um novo cliente: organização + primeiro usuário gestor (COMPANY_ADMIN). */
export async function createClient(input: NewClientInput) {
  const name = input.name.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const adminName = input.adminName.trim();
  const password = input.adminPassword || "nr1@2026";
  if (!name) throw new Error("Nome do cliente é obrigatório.");
  if (!adminName || !adminEmail) throw new Error("Nome e e-mail do gestor são obrigatórios.");

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) throw new Error("Já existe um usuário com este e-mail.");

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        legalName: input.legalName?.trim() || null,
        cnpj: input.cnpj?.trim() || null,
        industry: input.industry?.trim() || null,
      },
    });
    const user = await tx.user.create({
      data: { email: adminEmail, name: adminName, passwordHash: hashPassword(password) },
    });
    await tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "COMPANY_ADMIN", jobTitle: "Gestor" },
    });
    return { org, adminEmail, password };
  });
}

export async function setClientActive(organizationId: string, active: boolean) {
  return prisma.organization.update({ where: { id: organizationId }, data: { active } });
}

export function getClient(organizationId: string) {
  return prisma.organization.findUnique({ where: { id: organizationId } });
}

const intOrNull = (v: string | number | null | undefined) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** Edita os dados cadastrais do cliente (organização). */
export async function updateClientInfo(
  organizationId: string,
  data: { name?: string; legalName?: string | null; cnpj?: string | null; industry?: string | null },
) {
  const name = (data.name ?? "").trim();
  if (!name) throw new Error("Nome do cliente é obrigatório.");
  try {
    return await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        legalName: (data.legalName ?? "").trim() || null,
        cnpj: (data.cnpj ?? "").trim() || null,
        industry: (data.industry ?? "").trim() || null,
      },
    });
  } catch (e) {
    if (String((e as Error).message).includes("Unique")) throw new Error("Já existe uma organização com este CNPJ.");
    throw e;
  }
}

export async function updateClientPlan(
  organizationId: string,
  data: { plan?: string | null; maxUsers?: string | number | null; maxEmployees?: string | number | null },
) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: (data.plan ?? "").toString().trim() || null,
      maxUsers: intOrNull(data.maxUsers),
      maxEmployees: intOrNull(data.maxEmployees),
    },
  });
}

export async function updateClientBranding(
  organizationId: string,
  data: { logoUrl?: string | null; brandColor?: string | null },
) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      logoUrl: (data.logoUrl ?? "").trim() || null,
      brandColor: (data.brandColor ?? "").trim() || null,
    },
  });
}

/** Relatório de uso de um cliente. */
export async function clientUsage(organizationId: string) {
  const [users, employees, companies, risks, surveys, manifestations, lastLogin] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId } }),
    prisma.company.count({ where: { organizationId } }),
    prisma.risk.count({ where: { organizationId } }),
    prisma.survey.count({ where: { organizationId } }),
    prisma.manifestation.count({ where: { organizationId } }),
    prisma.auditLog.findFirst({ where: { organizationId, action: "auth.login" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  return { users, employees, companies, risks, surveys, manifestations, lastLoginAt: lastLogin?.createdAt ?? null };
}

/**
 * Garante que existe um Super Admin (provedor) e a organização do provedor.
 * Idempotente — chamado no bootstrap (ensureDb). Login: super@nr1.com / super123.
 */
export async function ensurePlatformAdmin() {
  const email = "super@nr1.com";
  const existing = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
  if (existing && existing.memberships.some((m) => m.role === "SUPER_ADMIN")) return;

  let providerOrg = await prisma.organization.findFirst({ where: { name: PROVIDER_ORG_NAME } });
  if (!providerOrg) {
    providerOrg = await prisma.organization.create({ data: { name: PROVIDER_ORG_NAME } });
  }
  const user =
    existing ??
    (await prisma.user.create({
      data: { email, name: "Super Admin", passwordHash: hashPassword("super123") },
    }));
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: providerOrg.id } },
    update: { role: "SUPER_ADMIN" },
    create: { userId: user.id, organizationId: providerOrg.id, role: "SUPER_ADMIN", jobTitle: "Provedor" },
  });
}

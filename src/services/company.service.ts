import { prisma } from "../db";

// =============================================================================
// CRUD de Empresas (cadastro corporativo). Isolado por tenant.
// =============================================================================

export interface CompanyInput {
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  inscricaoEstadual?: string | null;
  inscricaoMunicipal?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  status?: string | null;
  observacoes?: string | null;
}

const blank = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

function normalize(input: CompanyInput) {
  return {
    razaoSocial: input.razaoSocial.trim(),
    cnpj: input.cnpj.trim(),
    nomeFantasia: blank(input.nomeFantasia),
    inscricaoEstadual: blank(input.inscricaoEstadual),
    inscricaoMunicipal: blank(input.inscricaoMunicipal),
    endereco: blank(input.endereco),
    cidade: blank(input.cidade),
    estado: blank(input.estado),
    cep: blank(input.cep),
    telefone: blank(input.telefone),
    email: blank(input.email),
    status: blank(input.status),
    observacoes: blank(input.observacoes),
  };
}

export function listCompanies(organizationId: string) {
  return prisma.company.findMany({
    where: { organizationId },
    orderBy: { razaoSocial: "asc" },
    include: { _count: { select: { partners: true, contracts: true, suppliers: true, employees: true } } },
  });
}

export function getCompany(organizationId: string, id: string) {
  return prisma.company.findFirst({ where: { id, organizationId } });
}

export async function createCompany(organizationId: string, input: CompanyInput) {
  const data = normalize(input);
  if (!data.razaoSocial || !data.cnpj) throw new Error("Razão social e CNPJ são obrigatórios.");
  try {
    return await prisma.company.create({ data: { organizationId, ...data } });
  } catch (e) {
    if (String((e as Error).message).includes("Unique")) throw new Error("Já existe uma empresa com este CNPJ.");
    throw e;
  }
}

export async function updateCompany(organizationId: string, id: string, input: CompanyInput) {
  const existing = await prisma.company.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Empresa não encontrada.");
  const data = normalize(input);
  if (!data.razaoSocial || !data.cnpj) throw new Error("Razão social e CNPJ são obrigatórios.");
  try {
    return await prisma.company.update({ where: { id }, data });
  } catch (e) {
    if (String((e as Error).message).includes("Unique")) throw new Error("Já existe uma empresa com este CNPJ.");
    throw e;
  }
}

export async function deleteCompany(organizationId: string, id: string) {
  const existing = await prisma.company.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Empresa não encontrada.");
  // Remove os vínculos filhos antes da empresa (colaboradores ficam sem empresa).
  await prisma.$transaction([
    prisma.partner.deleteMany({ where: { companyId: id } }),
    prisma.contract.deleteMany({ where: { companyId: id } }),
    prisma.supplier.deleteMany({ where: { companyId: id } }),
    prisma.obligation.deleteMany({ where: { companyId: id } }),
    prisma.pendency.deleteMany({ where: { companyId: id } }),
    prisma.company.delete({ where: { id } }),
  ]);
}

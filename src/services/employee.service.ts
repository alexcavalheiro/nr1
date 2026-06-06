import { prisma } from "../db";

// =============================================================================
// CRUD de Colaboradores (força de trabalho NR-1). Vínculo opcional a empresa,
// setor e a um usuário do sistema (login). Isolado por tenant.
// =============================================================================

export interface EmployeeInput {
  name: string;
  cpf?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  status?: string | null;
  observacoes?: string | null;
  companyId?: string | null;
  departmentId?: string | null;
  userId?: string | null;
  admissionDate?: string | null; // YYYY-MM-DD
}

const blank = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

function normalize(input: EmployeeInput) {
  return {
    name: input.name.trim(),
    cpf: blank(input.cpf),
    email: blank(input.email),
    jobTitle: blank(input.jobTitle),
    phone: blank(input.phone),
    status: blank(input.status) ?? "ATIVO",
    observacoes: blank(input.observacoes),
    companyId: blank(input.companyId),
    departmentId: blank(input.departmentId),
    userId: blank(input.userId),
    admissionDate: input.admissionDate ? new Date(input.admissionDate) : null,
  };
}

export function listEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      company: { select: { razaoSocial: true, nomeFantasia: true } },
      department: { select: { name: true } },
      user: { select: { email: true } },
    },
  });
}

export function getEmployee(organizationId: string, id: string) {
  return prisma.employee.findFirst({ where: { id, organizationId } });
}

export async function createEmployee(organizationId: string, input: EmployeeInput) {
  const data = normalize(input);
  if (!data.name) throw new Error("Nome é obrigatório.");
  // Limite de colaboradores do plano (definido pelo provedor). null = ilimitado.
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { maxEmployees: true } });
  if (org?.maxEmployees != null) {
    const count = await prisma.employee.count({ where: { organizationId } });
    if (count >= org.maxEmployees) throw new Error(`Limite de colaboradores do plano atingido (${org.maxEmployees}). Fale com o provedor.`);
  }
  try {
    return await prisma.employee.create({ data: { organizationId, ...data } });
  } catch (e) {
    if (String((e as Error).message).includes("Unique")) throw new Error("Este usuário já está vinculado a outro colaborador.");
    throw e;
  }
}

export async function updateEmployee(organizationId: string, id: string, input: EmployeeInput) {
  const existing = await prisma.employee.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Colaborador não encontrado.");
  const data = normalize(input);
  if (!data.name) throw new Error("Nome é obrigatório.");
  try {
    return await prisma.employee.update({ where: { id }, data });
  } catch (e) {
    if (String((e as Error).message).includes("Unique")) throw new Error("Este usuário já está vinculado a outro colaborador.");
    throw e;
  }
}

export async function deleteEmployee(organizationId: string, id: string) {
  const existing = await prisma.employee.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Colaborador não encontrado.");
  return prisma.employee.delete({ where: { id } });
}

/** Empresas, setores e usuários do tenant — para os seletores do formulário. */
export async function employeeFormOptions(organizationId: string) {
  const [companies, departments, memberships] = await Promise.all([
    prisma.company.findMany({ where: { organizationId }, orderBy: { razaoSocial: "asc" }, select: { id: true, razaoSocial: true } }),
    prisma.department.findMany({ where: { organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const users = memberships.map((m) => m.user);
  return { companies, departments, users };
}

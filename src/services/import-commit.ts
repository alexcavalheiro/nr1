import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { onlyDigitsExport, readWorkbookRows } from "./import-data";

// =============================================================================
// GRAVAÇÃO DA IMPORTAÇÃO — persiste empresas e entidades vinculadas, com dedupe
// (empresa por CNPJ; filhos por chave natural), criando ou atualizando, e
// registra um ImportBatch (histórico). Tudo numa transação por tenant.
// =============================================================================

const digits = (v: string | undefined) => onlyDigitsExport(v ?? "");
const txt = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const date = (v: string | undefined) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);

export interface CommitResult {
  created: number;
  updated: number;
  perTab: Record<string, { created: number; updated: number }>;
  batchId: string;
}

export async function commitImport(
  organizationId: string,
  buffer: ArrayBuffer | Buffer,
  opts: { actorId?: string; fileName?: string } = {},
): Promise<CommitResult> {
  const rows = await readWorkbookRows(buffer);
  const perTab: Record<string, { created: number; updated: number }> = {};
  const bump = (tab: string, kind: "created" | "updated") => {
    perTab[tab] ??= { created: 0, updated: 0 };
    perTab[tab][kind]++;
  };

  await prisma.$transaction(async (tx) => {
    // Mapa CNPJ→companyId (inclui empresas já existentes da org).
    const cnpjToId = new Map<string, string>();
    for (const c of await tx.company.findMany({ where: { organizationId }, select: { id: true, cnpj: true } })) {
      cnpjToId.set(digits(c.cnpj), c.id);
    }

    // 1. Empresas -----------------------------------------------------------
    for (const r of rows["Empresas"] ?? []) {
      const cnpj = digits(r["CNPJ"]);
      if (!r["Razão Social"]?.trim() || !cnpj) continue;
      const data = {
        razaoSocial: r["Razão Social"].trim(),
        nomeFantasia: txt(r["Nome Fantasia"]),
        inscricaoEstadual: txt(r["Inscrição Estadual"]),
        inscricaoMunicipal: txt(r["Inscrição Municipal"]),
        endereco: txt(r["Endereço"]),
        cidade: txt(r["Cidade"]),
        estado: txt(r["Estado"]),
        cep: txt(r["CEP"]),
        telefone: txt(r["Telefone"]),
        email: txt(r["E-mail"]),
        status: txt(r["Status"]),
        observacoes: txt(r["Observações"]),
      };
      const existing = cnpjToId.get(cnpj);
      if (existing) {
        await tx.company.update({ where: { id: existing }, data });
        bump("Empresas", "updated");
      } else {
        const created = await tx.company.create({ data: { organizationId, cnpj, ...data } });
        cnpjToId.set(cnpj, created.id);
        bump("Empresas", "created");
      }
    }

    const companyId = (empresaCnpj: string | undefined) => cnpjToId.get(digits(empresaCnpj)) ?? null;

    // 2. Sócios -------------------------------------------------------------
    for (const r of rows["Sócios"] ?? []) {
      const nome = r["Nome do Sócio"]?.trim();
      if (!nome) continue;
      const cpfCnpj = txt(r["CPF/CNPJ"]);
      const data = {
        nome,
        cpfCnpj,
        tipo: txt(r["Tipo de Sócio"]),
        empresaVinculada: txt(r["Empresa Vinculada"]),
        empresaCnpj: txt(r["CNPJ da Empresa Vinculada"]),
        percentual: txt(r["Percentual de Participação"]),
        cargo: txt(r["Cargo/Função"]),
        dataEntrada: date(r["Data de Entrada"]),
        dataSaida: date(r["Data de Saída"]),
        status: txt(r["Status"]),
        observacoes: txt(r["Observações"]),
        companyId: companyId(r["CNPJ da Empresa Vinculada"]),
      };
      const found = cpfCnpj
        ? await tx.partner.findFirst({ where: { organizationId, cpfCnpj } })
        : await tx.partner.findFirst({ where: { organizationId, nome } });
      if (found) {
        await tx.partner.update({ where: { id: found.id }, data });
        bump("Sócios", "updated");
      } else {
        await tx.partner.create({ data: { organizationId, ...data } });
        bump("Sócios", "created");
      }
    }

    // 3. Contratos ----------------------------------------------------------
    for (const r of rows["Contratos"] ?? []) {
      const nome = r["Nome do Contrato"]?.trim();
      if (!nome) continue;
      const empresaCnpj = txt(r["CNPJ da Empresa Vinculada"]);
      const data = {
        nome,
        tipo: txt(r["Tipo de Contrato"]),
        empresaVinculada: txt(r["Empresa Vinculada"]),
        empresaCnpj,
        parteRelacionada: txt(r["Parte Relacionada"]),
        dataInicio: date(r["Data de Início"]),
        dataVencimento: date(r["Data de Vencimento"]),
        valor: txt(r["Valor"]),
        status: txt(r["Status"]),
        responsavel: txt(r["Responsável"]),
        observacoes: txt(r["Observações"]),
        companyId: companyId(r["CNPJ da Empresa Vinculada"]),
      };
      const found = await tx.contract.findFirst({ where: { organizationId, nome, empresaCnpj } });
      if (found) {
        await tx.contract.update({ where: { id: found.id }, data });
        bump("Contratos", "updated");
      } else {
        await tx.contract.create({ data: { organizationId, ...data } });
        bump("Contratos", "created");
      }
    }

    // 4. Fornecedores -------------------------------------------------------
    for (const r of rows["Fornecedores"] ?? []) {
      const nome = r["Razão Social/Nome"]?.trim();
      if (!nome) continue;
      const cnpjCpf = txt(r["CNPJ/CPF"]);
      const data = {
        nome,
        cnpjCpf,
        categoria: txt(r["Categoria"]),
        telefone: txt(r["Telefone"]),
        email: txt(r["E-mail"]),
        empresaVinculada: txt(r["Empresa Vinculada"]),
        empresaCnpj: txt(r["CNPJ da Empresa Vinculada"]),
        status: txt(r["Status"]),
        observacoes: txt(r["Observações"]),
        companyId: companyId(r["CNPJ da Empresa Vinculada"]),
      };
      const found = cnpjCpf
        ? await tx.supplier.findFirst({ where: { organizationId, cnpjCpf } })
        : await tx.supplier.findFirst({ where: { organizationId, nome } });
      if (found) {
        await tx.supplier.update({ where: { id: found.id }, data });
        bump("Fornecedores", "updated");
      } else {
        await tx.supplier.create({ data: { organizationId, ...data } });
        bump("Fornecedores", "created");
      }
    }

    // 5. Obrigações ---------------------------------------------------------
    for (const r of rows["Obrigações"] ?? []) {
      const nome = r["Nome da Obrigação"]?.trim();
      if (!nome) continue;
      const empresaCnpj = txt(r["CNPJ da Empresa Vinculada"]);
      const data = {
        nome,
        tipo: txt(r["Tipo de Obrigação"]),
        empresaVinculada: txt(r["Empresa Vinculada"]),
        empresaCnpj,
        prazo: date(r["Prazo"]),
        responsavel: txt(r["Responsável"]),
        status: txt(r["Status"]),
        prioridade: txt(r["Prioridade"]),
        observacoes: txt(r["Observações"]),
        companyId: companyId(r["CNPJ da Empresa Vinculada"]),
      };
      const found = await tx.obligation.findFirst({ where: { organizationId, nome, empresaCnpj } });
      if (found) {
        await tx.obligation.update({ where: { id: found.id }, data });
        bump("Obrigações", "updated");
      } else {
        await tx.obligation.create({ data: { organizationId, ...data } });
        bump("Obrigações", "created");
      }
    }

    // 6. Pendências ---------------------------------------------------------
    for (const r of rows["Pendências"] ?? []) {
      const titulo = r["Título da Pendência"]?.trim();
      if (!titulo) continue;
      const empresaCnpj = txt(r["CNPJ da Empresa Vinculada"]);
      const data = {
        titulo,
        descricao: txt(r["Descrição"]),
        empresaVinculada: txt(r["Empresa Vinculada"]),
        empresaCnpj,
        responsavel: txt(r["Responsável"]),
        prioridade: txt(r["Prioridade"]),
        status: txt(r["Status"]),
        dataLimite: date(r["Data Limite"]),
        observacoes: txt(r["Observações"]),
        companyId: companyId(r["CNPJ da Empresa Vinculada"]),
      };
      const found = await tx.pendency.findFirst({ where: { organizationId, titulo, empresaCnpj } });
      if (found) {
        await tx.pendency.update({ where: { id: found.id }, data });
        bump("Pendências", "updated");
      } else {
        await tx.pendency.create({ data: { organizationId, ...data } });
        bump("Pendências", "created");
      }
    }
  });

  const created = Object.values(perTab).reduce((s, t) => s + t.created, 0);
  const updated = Object.values(perTab).reduce((s, t) => s + t.updated, 0);

  const batch = await prisma.importBatch.create({
    data: {
      organizationId,
      actorId: opts.actorId,
      fileName: opts.fileName,
      created,
      updated,
      errors: 0,
      status: "COMPLETED",
      summary: perTab as Prisma.InputJsonValue,
    },
  });

  return { created, updated, perTab, batchId: batch.id };
}

export async function listImportBatches(organizationId: string) {
  return prisma.importBatch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function corporateCounts(organizationId: string) {
  const [companies, partners, contracts, suppliers, obligations, pendencies] = await Promise.all([
    prisma.company.count({ where: { organizationId } }),
    prisma.partner.count({ where: { organizationId } }),
    prisma.contract.count({ where: { organizationId } }),
    prisma.supplier.count({ where: { organizationId } }),
    prisma.obligation.count({ where: { organizationId } }),
    prisma.pendency.count({ where: { organizationId } }),
  ]);
  return { companies, partners, contracts, suppliers, obligations, pendencies };
}

// =============================================================================
// IMPORTAÇÃO / EXPORTAÇÃO DE PLANILHA PADRÃO
// Define o modelo (abas + colunas) e valida uma planilha preenchida.
// Geração/leitura via exceljs (já dependência do projeto). Sem persistência
// aqui — a etapa de gravar empresas/sócios/etc. depende de novos modelos.
// =============================================================================

export type FieldType = "text" | "cnpj" | "cpf" | "cpfcnpj" | "email" | "date" | "percent" | "money";

export interface ColumnSpec {
  header: string;
  required?: boolean;
  type?: FieldType;
}

export interface TabSpec {
  name: string;
  columns: ColumnSpec[];
}

export const TAB_SPECS: TabSpec[] = [
  {
    name: "Empresas",
    columns: [
      { header: "Razão Social", required: true },
      { header: "Nome Fantasia" },
      { header: "CNPJ", required: true, type: "cnpj" },
      { header: "Inscrição Estadual" },
      { header: "Inscrição Municipal" },
      { header: "Endereço" },
      { header: "Cidade" },
      { header: "Estado" },
      { header: "CEP" },
      { header: "Telefone" },
      { header: "E-mail", type: "email" },
      { header: "Status" },
      { header: "Observações" },
    ],
  },
  {
    name: "Sócios",
    columns: [
      { header: "Nome do Sócio", required: true },
      { header: "CPF/CNPJ", required: true, type: "cpfcnpj" },
      { header: "Tipo de Sócio" },
      { header: "Empresa Vinculada" },
      { header: "CNPJ da Empresa Vinculada", type: "cnpj" },
      { header: "Percentual de Participação", type: "percent" },
      { header: "Cargo/Função" },
      { header: "Data de Entrada", type: "date" },
      { header: "Data de Saída", type: "date" },
      { header: "Status" },
      { header: "Observações" },
    ],
  },
  {
    name: "Contratos",
    columns: [
      { header: "Nome do Contrato", required: true },
      { header: "Tipo de Contrato" },
      { header: "Empresa Vinculada" },
      { header: "CNPJ da Empresa Vinculada", type: "cnpj" },
      { header: "Parte Relacionada" },
      { header: "Data de Início", type: "date" },
      { header: "Data de Vencimento", type: "date" },
      { header: "Valor", type: "money" },
      { header: "Status" },
      { header: "Responsável" },
      { header: "Observações" },
    ],
  },
  {
    name: "Fornecedores",
    columns: [
      { header: "Razão Social/Nome", required: true },
      { header: "CNPJ/CPF", type: "cpfcnpj" },
      { header: "Categoria" },
      { header: "Telefone" },
      { header: "E-mail", type: "email" },
      { header: "Empresa Vinculada" },
      { header: "CNPJ da Empresa Vinculada", type: "cnpj" },
      { header: "Status" },
      { header: "Observações" },
    ],
  },
  {
    name: "Obrigações",
    columns: [
      { header: "Nome da Obrigação", required: true },
      { header: "Tipo de Obrigação" },
      { header: "Empresa Vinculada" },
      { header: "CNPJ da Empresa Vinculada", type: "cnpj" },
      { header: "Prazo", type: "date" },
      { header: "Responsável" },
      { header: "Status" },
      { header: "Prioridade" },
      { header: "Observações" },
    ],
  },
  {
    name: "Pendências",
    columns: [
      { header: "Título da Pendência", required: true },
      { header: "Descrição" },
      { header: "Empresa Vinculada" },
      { header: "CNPJ da Empresa Vinculada", type: "cnpj" },
      { header: "Responsável" },
      { header: "Prioridade" },
      { header: "Status" },
      { header: "Data Limite", type: "date" },
      { header: "Observações" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Validadores de formato (nativos, sem dependências).
// ---------------------------------------------------------------------------
const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function isValidCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(c[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function isValidCpf(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCell(type: FieldType | undefined, raw: string): string | null {
  if (!type || raw === "") return null;
  switch (type) {
    case "cnpj":
      return isValidCnpj(raw) ? null : "CNPJ inválido";
    case "cpf":
      return isValidCpf(raw) ? null : "CPF inválido";
    case "cpfcnpj":
      return isValidCpf(raw) || isValidCnpj(raw) ? null : "CPF/CNPJ inválido";
    case "email":
      return EMAIL_RE.test(raw) ? null : "E-mail inválido";
    case "date":
      return Number.isNaN(Date.parse(raw)) ? "Data inválida" : null;
    case "percent": {
      const n = Number(raw.replace("%", "").replace(",", "."));
      return Number.isNaN(n) || n < 0 || n > 100 ? "Percentual inválido (0–100)" : null;
    }
    case "money": {
      const n = Number(raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
      return Number.isNaN(n) ? "Valor inválido" : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Geração do modelo (.xlsx) — 6 abas, cabeçalho em negrito, colunas largas.
// ---------------------------------------------------------------------------
export async function buildTemplateWorkbook() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plataforma NR-1";
  for (const tab of TAB_SPECS) {
    const ws = wb.addWorksheet(tab.name);
    ws.columns = tab.columns.map((c) => ({
      header: c.required ? `${c.header} *` : c.header,
      key: c.header,
      width: Math.max(16, c.header.length + 4),
    }));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.alignment = { vertical: "middle" };
  }
  return wb;
}

// ---------------------------------------------------------------------------
// Validação da planilha preenchida → relatório de pré-validação.
// ---------------------------------------------------------------------------
export interface RowIssue {
  tab: string;
  row: number;
  column: string;
  message: string;
}

export interface TabReport {
  name: string;
  found: boolean;
  rows: number;
  missingColumns: string[];
  errorRows: number;
}

export interface ImportReport {
  tabs: TabReport[];
  issues: RowIssue[];
  totalRows: number;
  totalErrors: number;
  ok: boolean;
}

const normalize = (s: string) => s.replace(/\*/g, "").trim().toLowerCase();

export async function validateWorkbook(buffer: ArrayBuffer | Buffer): Promise<ImportReport> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer as ArrayBuffer));
  // exceljs aceita Buffer; cast amplo evita o atrito do Buffer genérico do Node.
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const tabs: TabReport[] = [];
  const issues: RowIssue[] = [];
  let totalRows = 0;

  for (const spec of TAB_SPECS) {
    const ws = wb.worksheets.find((w) => normalize(w.name) === normalize(spec.name));
    if (!ws) {
      tabs.push({ name: spec.name, found: false, rows: 0, missingColumns: spec.columns.filter((c) => c.required).map((c) => c.header), errorRows: 0 });
      issues.push({ tab: spec.name, row: 0, column: "—", message: "Aba não encontrada na planilha" });
      continue;
    }

    // Mapeia índice de cada coluna esperada a partir do cabeçalho (linha 1).
    const headerRow = ws.getRow(1);
    const headerMap = new Map<string, number>();
    headerRow.eachCell((cell, col) => headerMap.set(normalize(String(cell.value ?? "")), col));

    const missingColumns = spec.columns.filter((c) => c.required && !headerMap.has(normalize(c.header))).map((c) => c.header);
    for (const m of missingColumns) issues.push({ tab: spec.name, row: 1, column: m, message: "Coluna obrigatória ausente" });

    let dataRows = 0;
    let errorRows = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cellText = (col: number | undefined) => (col ? String(row.getCell(col).value ?? "").trim() : "");
      const hasData = spec.columns.some((c) => cellText(headerMap.get(normalize(c.header))) !== "");
      if (!hasData) continue;
      dataRows++;
      let rowHasError = false;
      for (const c of spec.columns) {
        const col = headerMap.get(normalize(c.header));
        const val = cellText(col);
        if (c.required && val === "") {
          issues.push({ tab: spec.name, row: r, column: c.header, message: "Campo obrigatório vazio" });
          rowHasError = true;
          continue;
        }
        const err = validateCell(c.type, val);
        if (err) {
          issues.push({ tab: spec.name, row: r, column: c.header, message: err });
          rowHasError = true;
        }
      }
      if (rowHasError) errorRows++;
    }

    totalRows += dataRows;
    tabs.push({ name: spec.name, found: true, rows: dataRows, missingColumns, errorRows });
  }

  const totalErrors = issues.length;
  return { tabs, issues, totalRows, totalErrors, ok: totalErrors === 0 && totalRows > 0 };
}

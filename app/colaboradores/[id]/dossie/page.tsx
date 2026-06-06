import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { employeeDossier } from "@/src/index";
import { canManage, requireSession, ROLE_LABEL } from "../../../lib/auth";
import { PrintButton } from "../../../components/PrintButton";

export const dynamic = "force-dynamic";

const fmt = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDT = (d?: Date | string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

const SURVEY_TYPE: Record<string, string> = { CLIMATE: "Clima", PSYCHOSOCIAL: "Psicossocial", PULSE: "Pulso", CUSTOM: "Pesquisa" };
const MANIF_STATUS: Record<string, string> = { OPEN: "Aberta", IN_PROGRESS: "Em tratamento", RESOLVED: "Resolvida", CLOSED: "Encerrada", ARCHIVED: "Arquivada" };
const PLAN_STATUS: Record<string, string> = { CREATED: "Criado", APPROVED: "Aprovado", IN_PROGRESS: "Em execução", EVIDENCED: "Evidenciado", CLOSED: "Encerrado", CANCELLED: "Cancelado" };
const PROG_STATUS: Record<string, string> = { NOT_STARTED: "Não iniciado", IN_PROGRESS: "Em andamento", COMPLETED: "Concluído" };

export default async function DossiePage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const d = await employeeDossier(session.organizationId, id);
  if (!d) notFound();

  const e = d.employee;
  const c = e.company;

  return (
    <div className="report container">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <a href={`/colaboradores/${id}`} className="nav-link">← Voltar</a>
        <PrintButton />
      </div>

      <h1>Dossiê do Colaborador</h1>
      <p className="muted">{e.name} · gerado em {fmtDT(d.generatedAt)}</p>

      <h2>1. Empresa contratante</h2>
      <table>
        <tbody>
          <tr><td>Organização (plataforma)</td><td>{d.organization?.name ?? "—"}</td></tr>
          <tr><td>Empresa contratante</td><td>{c?.razaoSocial ?? "— (não vinculada)"}</td></tr>
          {c?.nomeFantasia && <tr><td>Nome fantasia</td><td>{c.nomeFantasia}</td></tr>}
          <tr><td>CNPJ</td><td>{c?.cnpj ?? d.organization?.cnpj ?? "—"}</td></tr>
          <tr><td>Endereço</td><td>{[c?.endereco, c?.cidade, c?.estado, c?.cep].filter(Boolean).join(", ") || "—"}</td></tr>
          <tr><td>Contato</td><td>{[c?.telefone, c?.email].filter(Boolean).join(" · ") || "—"}</td></tr>
        </tbody>
      </table>

      <h2>2. Dados do colaborador</h2>
      <table>
        <tbody>
          <tr><td>Nome</td><td>{e.name}</td></tr>
          <tr><td>CPF</td><td>{e.cpf ?? "—"}</td></tr>
          <tr><td>Cargo</td><td>{e.jobTitle ?? "—"}</td></tr>
          <tr><td>Setor</td><td>{e.department?.name ?? "—"}</td></tr>
          <tr><td>E-mail</td><td>{e.email ?? "—"}</td></tr>
          <tr><td>Telefone</td><td>{e.phone ?? "—"}</td></tr>
          <tr><td>Admissão</td><td>{fmt(e.admissionDate)}</td></tr>
          <tr><td>Status</td><td>{e.status ?? "—"}</td></tr>
          <tr><td>Observações</td><td>{e.observacoes ?? "—"}</td></tr>
          <tr><td>Cadastrado em</td><td>{fmt(e.createdAt)}</td></tr>
        </tbody>
      </table>

      <h2>3. Acesso ao sistema</h2>
      {d.access ? (
        <table>
          <tbody>
            <tr><td>Perfil</td><td>{ROLE_LABEL[d.access.role] ?? d.access.role}</td></tr>
            <tr><td>E-mail de acesso</td><td>{d.access.email ?? "—"}</td></tr>
            <tr><td>Situação</td><td>{d.access.active ? "Ativo" : "Inativo"}</td></tr>
            <tr><td>Validade de acesso</td><td>{d.access.accessExpiresAt ? fmt(d.access.accessExpiresAt) : "Sem expiração"}</td></tr>
            <tr><td>2FA</td><td>{d.access.twoFactor ? "Ativado" : "Desativado"}</td></tr>
            <tr><td>Último acesso</td><td>{fmtDT(d.access.lastLoginAt)}</td></tr>
            <tr><td>Conta criada em</td><td>{fmt(d.access.createdAt)}</td></tr>
          </tbody>
        </table>
      ) : (
        <p className="muted">Colaborador sem usuário de login vinculado.</p>
      )}

      <h2>4. Pesquisas respondidas ({d.history.surveyResponses.length})</h2>
      {d.history.surveyResponses.length === 0 ? <p className="muted">Nenhuma resposta registrada (respostas anônimas não são vinculadas).</p> : (
        <table>
          <thead><tr><th>Pesquisa</th><th>Tipo</th><th>Data</th></tr></thead>
          <tbody>{d.history.surveyResponses.map((r) => <tr key={r.id}><td>{r.survey.title}</td><td>{SURVEY_TYPE[r.survey.type] ?? r.survey.type}</td><td>{fmt(r.submittedAt)}</td></tr>)}</tbody>
        </table>
      )}

      <h2>5. Relatos / Escuta ativa ({d.history.manifestations.length})</h2>
      {d.history.manifestations.length === 0 ? <p className="muted">Nenhum relato como autor.</p> : (
        <table>
          <thead><tr><th>Assunto</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>{d.history.manifestations.map((m) => <tr key={m.id}><td>{m.subject ?? "(sem assunto)"}{m.anonymous ? " · anônimo" : ""}</td><td>{MANIF_STATUS[m.status] ?? m.status}</td><td>{fmt(m.createdAt)}</td></tr>)}</tbody>
        </table>
      )}
      {d.history.handledCount > 0 && <p className="muted">Também atuou no tratamento de {d.history.handledCount} relato(s).</p>}

      <h2>6. Treinamentos / Aprendizagem ({d.history.learning.length})</h2>
      {d.history.learning.length === 0 ? <p className="muted">Sem progresso registrado.</p> : (
        <table>
          <thead><tr><th>Conteúdo</th><th>Status</th><th>%</th><th>Concluído em</th></tr></thead>
          <tbody>{d.history.learning.map((l) => <tr key={l.id}><td>{l.content.title}</td><td>{PROG_STATUS[l.status] ?? l.status}</td><td>{l.progressPercent}%</td><td>{fmt(l.completedAt)}</td></tr>)}</tbody>
        </table>
      )}

      <h2>7. Planos de ação sob responsabilidade ({d.history.actionPlans.length})</h2>
      {d.history.actionPlans.length === 0 ? <p className="muted">Nenhum.</p> : (
        <table>
          <thead><tr><th>Plano</th><th>Status</th><th>Prazo</th></tr></thead>
          <tbody>{d.history.actionPlans.map((p) => <tr key={p.id}><td>{p.title}</td><td>{PLAN_STATUS[p.status] ?? p.status}</td><td>{fmt(p.dueDate)}</td></tr>)}</tbody>
        </table>
      )}

      <h2>8. Evidências enviadas ({d.history.evidences.length})</h2>
      {d.history.evidences.length === 0 ? <p className="muted">Nenhuma.</p> : (
        <table>
          <thead><tr><th>Arquivo</th><th>Plano</th><th>Data</th></tr></thead>
          <tbody>{d.history.evidences.map((ev) => <tr key={ev.id}><td>{ev.fileName ?? "arquivo"}</td><td>{ev.actionPlan.title}</td><td>{fmt(ev.uploadedAt)}</td></tr>)}</tbody>
        </table>
      )}

      <h2>9. Trilha de auditoria ({d.audit.length})</h2>
      {d.audit.length === 0 ? <p className="muted">Sem eventos.</p> : (
        <table>
          <thead><tr><th>Data</th><th>Ação</th><th>Entidade</th></tr></thead>
          <tbody>{d.audit.map((a) => <tr key={a.id}><td>{fmtDT(a.createdAt)}</td><td>{a.action}</td><td>{a.entityType}</td></tr>)}</tbody>
        </table>
      )}

      <p className="muted" style={{ marginTop: 28 }}>
        Documento gerado pela Plataforma NR-1 em {fmtDT(d.generatedAt)}. Contém dados pessoais — tratar conforme a LGPD.
      </p>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { clientUsage, getClient } from "@/src/index";
import { requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { enterClientAction, updateBrandingAction, updateClientInfoAction, updatePlanAction } from "../actions";

export const dynamic = "force-dynamic";

const Stat = ({ label, value, limit }: { label: string; value: number; limit?: number | null }) => (
  <div>
    <div className="stat-label">{label}</div>
    <strong style={{ fontSize: 20 }}>
      {value}
      {limit != null && <span className="hint"> / {limit}</span>}
    </strong>
  </div>
);

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const [client, usage] = await Promise.all([getClient(id), clientUsage(id)]);
  if (!client) notFound();

  return (
    <AppShell session={session} active="admin" title={client.name} subtitle="Cliente — plano, marca e uso" showReport={false}>
      <p style={{ marginBottom: 16 }}><Link href="/admin" className="btn-ghost btn-sm">← Voltar para Clientes</Link></p>
      {ok === "plan" && <p className="success" style={{ marginBottom: 16 }}>Plano atualizado.</p>}
      {ok === "brand" && <p className="success" style={{ marginBottom: 16 }}>Marca atualizada.</p>}
      {ok === "info" && <p className="success" style={{ marginBottom: 16 }}>Cadastro atualizado.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Dados cadastrais</h2>
        <form action={updateClientInfoAction}>
          <input type="hidden" name="id" value={client.id} />
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 2 }}><label>Nome do cliente *</label><input name="name" defaultValue={client.name} required /></div>
            <div style={{ flex: 2 }}><label>Razão social</label><input name="legalName" defaultValue={client.legalName ?? ""} /></div>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 1 }}><label>CNPJ</label><input name="cnpj" defaultValue={client.cnpj ?? ""} /></div>
            <div style={{ flex: 1 }}><label>Segmento</label><input name="industry" defaultValue={client.industry ?? ""} /></div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 6 }}>Salvar cadastro</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Relatório de uso</h2>
          <span className="badge AI">Plano: {client.plan ?? "—"}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 12 }}>
          <Stat label="Usuários" value={usage.users} limit={client.maxUsers} />
          <Stat label="Colaboradores" value={usage.employees} limit={client.maxEmployees} />
          <Stat label="Empresas" value={usage.companies} />
          <Stat label="Riscos" value={usage.risks} />
          <Stat label="Pesquisas" value={usage.surveys} />
          <Stat label="Relatos" value={usage.manifestations} />
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Último acesso: {usage.lastLoginAt ? new Date(usage.lastLoginAt).toLocaleString("pt-BR") : "nunca"} · Status: {client.active ? "Ativo" : "Suspenso"}
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Plano e limites</h2>
          <form action={updatePlanAction}>
            <input type="hidden" name="id" value={client.id} />
            <label>Plano</label>
            <select name="plan" defaultValue={client.plan ?? "BASIC"}>
              {["FREE", "BASIC", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}><label>Máx. usuários</label><input name="maxUsers" type="number" min={0} defaultValue={client.maxUsers ?? ""} placeholder="ilimitado" /></div>
              <div style={{ flex: 1 }}><label>Máx. colaboradores</label><input name="maxEmployees" type="number" min={0} defaultValue={client.maxEmployees ?? ""} placeholder="ilimitado" /></div>
            </div>
            <p className="hint" style={{ marginTop: 6 }}>Deixe em branco para ilimitado. Ao atingir o limite, o cliente não consegue cadastrar mais.</p>
            <button className="btn" type="submit" style={{ marginTop: 10 }}>Salvar plano</button>
          </form>
        </div>

        <div className="card">
          <h2>Marca</h2>
          <form action={updateBrandingAction}>
            <input type="hidden" name="id" value={client.id} />
            <label>URL do logo</label>
            <input name="logoUrl" defaultValue={client.logoUrl ?? ""} placeholder="https://.../logo.png" />
            <label style={{ marginTop: 8 }}>Cor da marca</label>
            <input name="brandColor" type="text" defaultValue={client.brandColor ?? ""} placeholder="#7c3aed" />
            {client.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <p style={{ marginTop: 10 }}><img src={client.logoUrl} alt="logo" style={{ maxHeight: 40 }} /></p>
            )}
            <button className="btn" type="submit" style={{ marginTop: 10 }}>Salvar marca</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <form action={enterClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <button className="btn" type="submit">Entrar no ambiente deste cliente →</button>
        </form>
      </div>
    </AppShell>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { clientUsage, getClient } from "@/src/index";
import { requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { applyPresetAction, enterClientAction, updateBrandingAction, updateClientInfoAction, updatePlanAction } from "../actions";

const PRESETS = [
  { key: "indigo", label: "Indigo", c: "#7c5cff" },
  { key: "esmeralda", label: "Esmeralda", c: "#22c55e" },
  { key: "oceano", label: "Oceano", c: "#0ea5e9" },
  { key: "grafite", label: "Grafite", c: "#475569" },
];

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
          {client.logoUrl && (
            <p style={{ marginBottom: 10 }}>
              <span className="stat-label" style={{ display: "block", marginBottom: 4 }}>Logo atual:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={client.logoUrl} alt="logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain" }} />
            </p>
          )}
          <form action={updateBrandingAction}>
            <input type="hidden" name="id" value={client.id} />
            <label>Logo (arquivo de imagem, máx. 400 KB)</label>
            <input name="logoFile" type="file" accept="image/*" />
            {client.logoUrl && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontWeight: "normal" }}>
                <input type="checkbox" name="removeLogo" style={{ width: "auto" }} /> Remover logo atual
              </label>
            )}
            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label>Cor primária</label>
                <input name="brandColor" type="color" defaultValue={client.brandColor || "#7c5cff"} style={{ height: 40, padding: 2 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Cor secundária</label>
                <input name="accentColor" type="color" defaultValue={client.accentColor || "#4f8cff"} style={{ height: 40, padding: 2 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Tema</label>
                <select name="theme" defaultValue={client.theme ?? "dark"}>
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Cantos</label>
                <select name="corners" defaultValue={client.corners ?? "rounded"}>
                  <option value="rounded">Arredondados</option>
                  <option value="square">Retos</option>
                </select>
              </div>
            </div>
            <label style={{ marginTop: 8 }}>Mensagem de boas-vindas (aparece no topo para os usuários do cliente)</label>
            <input name="welcomeBanner" defaultValue={client.welcomeBanner ?? ""} maxLength={280} placeholder="Ex.: Bem-vindo à plataforma de saúde organizacional da Acme!" />
            <button className="btn" type="submit" style={{ marginTop: 10 }}>Salvar marca e tema</button>
          </form>

          <div style={{ marginTop: 14 }}>
            <span className="stat-label">Temas prontos:</span>
            <div className="form-row" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {PRESETS.map((p) => (
                <form key={p.key} action={applyPresetAction}>
                  <input type="hidden" name="id" value={client.id} />
                  <input type="hidden" name="preset" value={p.key} />
                  <button type="submit" className="badge" style={{ border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: p.c, display: "inline-block" }} /> {p.label}
                  </button>
                </form>
              ))}
            </div>
          </div>

          <p className="hint" style={{ marginTop: 10 }}>
            Link de login com a marca do cliente: <code>/login?c={client.id}</code>
          </p>
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

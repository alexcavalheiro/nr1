import Link from "next/link";
import type { ReactNode } from "react";
import { ensureDb, prisma } from "@/src/db";
import type { Session } from "../lib/auth";
import { canManage, canViewDocs, ROLE_LABEL } from "../lib/auth";
import { logout } from "../lib/auth-actions";
import { exitClientAction } from "../admin/actions";
import {
  IconBook, IconBot, IconBuilding, IconDashboard, IconDocuments, IconFileDown,
  IconListening, IconMegaphone, IconMonitoring, IconPlug, IconRisks, IconShield, IconShieldCheck, IconSurveys, IconUsers, IconZap,
} from "./icons";

export type ShellKey =
  | "admin" | "inicio" | "dashboard" | "learning" | "hub" | "risks" | "surveys" | "listening"
  | "monitoring" | "documents" | "assistant" | "automations" | "integrations" | "privacy"
  | "empresas" | "colaboradores" | "users" | "permissions" | "account" | "import-export" | "audit";

const NAV: { key: ShellKey; href: string; label: string; Icon: typeof IconDashboard; manage?: boolean; docs?: boolean; super?: boolean }[] = [
  { key: "admin", href: "/admin", label: "Clientes", Icon: IconBuilding, super: true },
  { key: "inicio", href: "/inicio", label: "Início", Icon: IconDashboard },
  { key: "dashboard", href: "/dashboard", label: "Dashboard", Icon: IconDashboard, manage: true },
  { key: "learning", href: "/learning", label: "Aprendizagem", Icon: IconBook },
  { key: "hub", href: "/hub", label: "Hub", Icon: IconMegaphone },
  { key: "risks", href: "/risks", label: "Riscos", Icon: IconRisks },
  { key: "surveys", href: "/surveys", label: "Pesquisas", Icon: IconSurveys },
  { key: "listening", href: "/listening", label: "Escuta", Icon: IconListening },
  { key: "monitoring", href: "/monitoring", label: "Monitoramento", Icon: IconMonitoring },
  { key: "documents", href: "/documents", label: "Documentos", Icon: IconDocuments },
  { key: "assistant", href: "/assistant", label: "Assistente IA", Icon: IconBot },
  { key: "automations", href: "/automations", label: "Automações", Icon: IconZap, manage: true },
  { key: "integrations", href: "/integrations", label: "Integrações", Icon: IconPlug, manage: true },
  { key: "privacy", href: "/privacy", label: "Privacidade / LGPD", Icon: IconShieldCheck },
  { key: "empresas", href: "/empresas", label: "Empresas", Icon: IconBuilding, manage: true },
  { key: "colaboradores", href: "/colaboradores", label: "Colaboradores", Icon: IconUsers, manage: true },
  { key: "users", href: "/users", label: "Usuários", Icon: IconUsers, manage: true },
  { key: "permissions", href: "/permissions", label: "Permissões", Icon: IconShield, manage: true },
  { key: "import-export", href: "/import-export", label: "Import/Export", Icon: IconFileDown, manage: true },
  { key: "audit", href: "/audit", label: "Auditoria", Icon: IconShield, docs: true },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Tema white-label por cliente: sobrescreve variáveis CSS no :root. */
export function buildThemeCss(org: { brandColor?: string | null; accentColor?: string | null; theme?: string | null; corners?: string | null } | null): string {
  if (!org) return "";
  const vars: string[] = [];
  const hex = (c?: string | null) => (c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : null);
  const color = hex(org.brandColor);
  const accent = hex(org.accentColor);
  if (color) vars.push(`--purple:${color}`, `--ai:${color}`);
  if (accent) vars.push(`--blue:${accent}`);
  if (org.theme === "light") {
    vars.push(
      "--bg:#f5f6fa", "--bg-elev:#ffffff", "--card:#ffffff", "--card-2:#eef1f7",
      "--text:#14171f", "--muted:#5a6175", "--faint:#98a0b3",
      "--border:rgba(0,0,0,0.10)", "--border-strong:rgba(0,0,0,0.16)",
    );
  }
  if (org.corners === "square") vars.push("--radius:6px", "--radius-sm:4px");
  return vars.length ? `:root{${vars.join(";")}}` : "";
}

export async function AppShell({
  session, active, title, subtitle, children, showReport = true,
}: {
  session: Session;
  active: ShellKey;
  title: string;
  subtitle?: string;
  children: ReactNode;
  showReport?: boolean;
}) {
  await ensureDb();
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, logoUrl: true, brandColor: true, accentColor: true, theme: true, corners: true, welcomeBanner: true },
  });
  const isSuper = session.role === "SUPER_ADMIN" && !session.impersonating;
  const themeCss = buildThemeCss(org);

  return (
    <div className="layout">
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <aside className="sidebar">
        <div className="sidebar-brand">
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain" }} />
          ) : (
            <>
              <span className="logo-mark">NR</span>
              <span className="logo-text">Plataforma NR-1<small>Saúde Organizacional</small></span>
            </>
          )}
        </div>
        <nav className="side-nav">
          <span className="side-nav-label">Plataforma</span>
          {NAV.filter((n) => (n.super ? isSuper : n.docs ? canViewDocs(session.role) : !n.manage || canManage(session.role))).map(({ key, href, label, Icon }) => (
            <Link key={key} href={href} className={`side-link${active === key ? " active" : ""}`}>
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link href="/account" className="side-user" title="Minha conta">
            <div className="avatar">{initials(session.name)}</div>
            <div className="meta">
              <div className="name">{session.name}</div>
              <div className="role">{ROLE_LABEL[session.role] ?? session.role}</div>
            </div>
          </Link>
          <form action={logout}><button className="btn-ghost" style={{ width: "100%", marginTop: 6 }} type="submit">Sair</button></form>
        </div>
      </aside>

      <div className="main">
        {session.impersonating && (
          <div style={{ background: "#7c3aed", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>👁️ Modo provedor — você está no cliente <strong>{session.impersonating}</strong></span>
            <form action={exitClientAction}>
              <button type="submit" className="btn-sm" style={{ background: "#fff", color: "#7c3aed", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Sair do cliente</button>
            </form>
          </div>
        )}
        {org?.welcomeBanner && (
          <div style={{ background: "var(--card-2)", borderBottom: "1px solid var(--border)", padding: "8px 16px", color: "var(--text)", fontSize: 14 }}>
            👋 {org.welcomeBanner}
          </div>
        )}
        <header className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
          <div className="header-tools">
            <select className="chip chip-select" defaultValue="30" aria-label="Período">
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
            <span className="chip"><IconBuilding /> {org?.name ?? "—"}</span>
            {showReport && (
              <Link href="/documents/report" className="btn btn-sm"><IconFileDown /> Gerar relatório</Link>
            )}
            <div className="avatar" title={session.name}>{initials(session.name)}</div>
          </div>
        </header>
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}

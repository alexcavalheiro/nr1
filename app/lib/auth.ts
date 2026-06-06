import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

// =============================================================================
// Sessão multi-tenant via cookie assinado (HMAC-SHA256). Carrega o tenant
// (organizationId) e o papel (role) resolvidos no login a partir do Membership.
// =============================================================================

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-troque-em-producao";
const COOKIE = "nr1_session";
const MAX_AGE = 60 * 60 * 8; // 8h

export interface Session {
  userId: string;
  organizationId: string;
  role: string;
  name: string;
  // Impersonação pelo Super Admin: nome do cliente em que ele "entrou" e a
  // organização de origem (provedor) para poder voltar.
  impersonating?: string;
  homeOrgId?: string;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createSession(session: Session): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Exige sessão válida; redireciona para /login se ausente. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// --- 2FA: estado intermediário entre senha validada e código TOTP confirmado ---
const PENDING_COOKIE = "nr1_2fa";
const PENDING_MAX_AGE = 5 * 60; // 5 min para digitar o código

/** Guarda a sessão pendente (já autenticada por senha) aguardando o TOTP. */
export async function createPending2fa(session: Session): Promise<void> {
  const body = { ...session, exp: Date.now() + PENDING_MAX_AGE * 1000 };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: PENDING_MAX_AGE });
}

/** Lê a sessão pendente de 2FA (ou null se ausente/expirada/adulterada). */
export async function getPending2fa(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session & { exp: number };
    if (Date.now() > body.exp) return null;
    const { exp, ...session } = body;
    void exp;
    return session;
  } catch {
    return null;
  }
}

export async function clearPending2fa(): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
}

// Perfis que podem gerir riscos/planos (escrita). UNIT_MANAGER gere, mas
// restrito ao seu escopo (ver scope.service). Demais são leitura.
const MANAGER_ROLES = ["SUPER_ADMIN", "CONSULTANT", "COMPANY_ADMIN", "HR", "UNIT_MANAGER"];
// Perfis técnicos/conformidade: leitura + evidências (sem gestão).
const COMPLIANCE_ROLES = ["AUDITOR", "SESMT", "OCCUPATIONAL_DOCTOR", "CIPA_MEMBER"];
export function canManage(role: string): boolean {
  return MANAGER_ROLES.includes(role);
}

// Documentação/GRO: gestores + perfis de conformidade (leitura).
export function canViewDocs(role: string): boolean {
  return canManage(role) || COMPLIANCE_ROLES.includes(role);
}

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CONSULTANT: "Consultor NR-1",
  COMPANY_ADMIN: "Gestor",
  HR: "RH",
  LEADER: "Líder",
  EMPLOYEE: "Colaborador",
  AUDITOR: "Auditor",
  UNIT_MANAGER: "Gestor de Unidade",
  SESMT: "SESMT (Seg. do Trabalho)",
  OCCUPATIONAL_DOCTOR: "Médico do Trabalho",
  CIPA_MEMBER: "Membro CIPA",
};

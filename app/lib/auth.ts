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

// Perfis que podem gerir riscos/planos (escrita). Demais são leitura.
const MANAGER_ROLES = ["SUPER_ADMIN", "CONSULTANT", "COMPANY_ADMIN", "HR"];
export function canManage(role: string): boolean {
  return MANAGER_ROLES.includes(role);
}

// Documentação/GRO: gestores + Auditor (perfil de leitura/conformidade).
export function canViewDocs(role: string): boolean {
  return canManage(role) || role === "AUDITOR";
}

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CONSULTANT: "Consultor NR-1",
  COMPANY_ADMIN: "Gestor",
  HR: "RH",
  LEADER: "Líder",
  EMPLOYEE: "Colaborador",
  AUDITOR: "Auditor",
};

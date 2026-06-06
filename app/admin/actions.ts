"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { createClient, getClient, setClientActive, updateClientBranding, updateClientInfo, updateClientPlan, writeAudit } from "@/src/index";
import { createSession, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Apenas o provedor da plataforma. */
async function guardSuper(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") throw new Error("Acesso restrito ao provedor da plataforma.");
  return session;
}

export async function createClientAction(formData: FormData) {
  const s = await guardSuper();
  try {
    const { org, adminEmail, password } = await createClient({
      name: str(formData, "name"),
      legalName: str(formData, "legalName"),
      cnpj: str(formData, "cnpj"),
      industry: str(formData, "industry"),
      adminName: str(formData, "adminName"),
      adminEmail: str(formData, "adminEmail"),
      adminPassword: str(formData, "adminPassword"),
    });
    await writeAudit({ organizationId: org.id, actorId: s.userId, action: "client.created", entityType: "Organization", entityId: org.id, metadata: { name: org.name, adminEmail } });
    revalidatePath("/admin");
    redirect(`/admin?created=${encodeURIComponent(`${org.name}|${adminEmail}|${password}`)}`);
  } catch (e) {
    if ((e as Error).message === "NEXT_REDIRECT") throw e;
    redirect(`/admin?error=${encodeURIComponent((e as Error).message)}`);
  }
}

export async function toggleClientAction(formData: FormData) {
  const s = await guardSuper();
  const id = str(formData, "id");
  const active = str(formData, "active") === "true";
  await setClientActive(id, active);
  await writeAudit({ organizationId: id, actorId: s.userId, action: active ? "client.activated" : "client.suspended", entityType: "Organization", entityId: id });
  revalidatePath("/admin");
}

export async function updateClientInfoAction(formData: FormData) {
  const s = await guardSuper();
  const id = str(formData, "id");
  try {
    await updateClientInfo(id, {
      name: str(formData, "name"),
      legalName: str(formData, "legalName"),
      cnpj: str(formData, "cnpj"),
      industry: str(formData, "industry"),
    });
    await writeAudit({ organizationId: id, actorId: s.userId, action: "client.info_updated", entityType: "Organization", entityId: id });
  } catch (e) {
    if ((e as Error).message === "NEXT_REDIRECT") throw e;
    redirect(`/admin/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath(`/admin/${id}`);
  redirect(`/admin/${id}?ok=info`);
}

export async function updatePlanAction(formData: FormData) {
  const s = await guardSuper();
  const id = str(formData, "id");
  await updateClientPlan(id, {
    plan: str(formData, "plan"),
    maxUsers: str(formData, "maxUsers"),
    maxEmployees: str(formData, "maxEmployees"),
  });
  await writeAudit({ organizationId: id, actorId: s.userId, action: "client.plan_updated", entityType: "Organization", entityId: id, metadata: { plan: str(formData, "plan") } });
  revalidatePath(`/admin/${id}`);
  redirect(`/admin/${id}?ok=plan`);
}

export async function updateBrandingAction(formData: FormData) {
  const s = await guardSuper();
  const id = str(formData, "id");
  await updateClientBranding(id, { logoUrl: str(formData, "logoUrl"), brandColor: str(formData, "brandColor") });
  await writeAudit({ organizationId: id, actorId: s.userId, action: "client.branding_updated", entityType: "Organization", entityId: id });
  revalidatePath(`/admin/${id}`);
  redirect(`/admin/${id}?ok=brand`);
}

/** Entra no ambiente de um cliente (impersonação). Mantém o papel SUPER_ADMIN. */
export async function enterClientAction(formData: FormData) {
  const s = await guardSuper();
  const id = str(formData, "id");
  const org = await getClient(id);
  if (!org) throw new Error("Cliente não encontrado.");
  await writeAudit({ organizationId: id, actorId: s.userId, action: "client.impersonate_enter", entityType: "Organization", entityId: id, metadata: { name: org.name } });
  await createSession({
    userId: s.userId,
    organizationId: org.id,
    role: "SUPER_ADMIN",
    name: s.name,
    impersonating: org.name,
    homeOrgId: s.homeOrgId ?? s.organizationId,
  });
  redirect("/dashboard");
}

/** Sai do cliente e volta ao painel do provedor. */
export async function exitClientAction() {
  await ensureDb();
  const s = await requireSession();
  if (!s.impersonating || !s.homeOrgId) redirect("/admin");
  await writeAudit({ organizationId: s.organizationId, actorId: s.userId, action: "client.impersonate_exit", entityType: "Organization", entityId: s.organizationId });
  await createSession({ userId: s.userId, organizationId: s.homeOrgId, role: "SUPER_ADMIN", name: s.name });
  redirect("/admin");
}

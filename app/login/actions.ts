"use server";

import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { verifyPassword } from "@/src/auth-crypto";
import { verifyTotp } from "@/src/services/totp.service";
import { writeAudit } from "@/src/index";
import { clearPending2fa, createPending2fa, createSession, getPending2fa } from "../lib/auth";

export async function login(formData: FormData) {
  await ensureDb();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { active: true }, take: 1 } },
  });

  const membership = user?.memberships[0];
  if (!user || !membership || !verifyPassword(password, user.passwordHash)) {
    if (user) await writeAudit({ organizationId: user.memberships[0]?.organizationId, actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, metadata: { email } });
    redirect("/login?error=1");
  }

  // Validade de acesso: bloqueia se o vínculo estiver expirado.
  if (membership.accessExpiresAt && membership.accessExpiresAt.getTime() < Date.now()) {
    await writeAudit({ organizationId: membership.organizationId, actorId: user.id, action: "auth.access_expired", entityType: "Membership", entityId: membership.id });
    redirect("/login?error=expired");
  }

  const pending = {
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    name: user.name,
  };

  // 2FA: se habilitado, exige o código TOTP antes de criar a sessão.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    await createPending2fa(pending);
    redirect("/login/2fa");
  }

  await createSession(pending);
  await writeAudit({ organizationId: membership.organizationId, actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
  redirect("/dashboard");
}

/** Segundo fator: confirma o código TOTP e cria a sessão definitiva. */
export async function verifyTwoFactor(formData: FormData) {
  await ensureDb();
  const pending = await getPending2fa();
  if (!pending) redirect("/login?error=1");

  const user = await prisma.user.findUnique({ where: { id: pending.userId } });
  const code = String(formData.get("code") ?? "");
  if (!user?.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) {
    await writeAudit({ organizationId: pending.organizationId, actorId: pending.userId, action: "auth.2fa_failed", entityType: "User", entityId: pending.userId });
    redirect("/login/2fa?error=1");
  }

  await clearPending2fa();
  await createSession(pending);
  await writeAudit({ organizationId: pending.organizationId, actorId: pending.userId, action: "auth.login", entityType: "User", entityId: pending.userId, metadata: { twoFactor: true } });
  redirect("/dashboard");
}

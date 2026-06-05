"use server";

import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { changeOwnPassword, updateOwnProfile, writeAudit } from "@/src/index";
import { verifyTotp } from "@/src/services/totp.service";
import { createSession, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function updateProfileAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  try {
    const user = await updateOwnProfile(session.userId, str(formData, "name"), str(formData, "email"));
    // Atualiza o nome guardado no cookie de sessão para refletir na UI.
    await createSession({ ...session, name: user.name });
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "account.profile_updated", entityType: "User", entityId: session.userId });
  } catch (e) {
    redirect(`/account?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/account?profile=1");
}

export async function changePasswordAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const current = str(formData, "current");
  const next = str(formData, "password");
  const confirm = str(formData, "confirm");

  try {
    if (next !== confirm) throw new Error("A confirmação não confere com a nova senha.");
    await changeOwnPassword(session.userId, current, next);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "account.password_changed", entityType: "User", entityId: session.userId });
  } catch (e) {
    redirect(`/account?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/account?ok=1");
}

/** Ativa o 2FA após confirmar um código gerado com o segredo exibido. */
export async function enableTwoFactorAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const secret = str(formData, "secret").trim();
  const code = str(formData, "code");
  if (!secret || !verifyTotp(secret, code)) {
    redirect(`/account?setup2fa=1&error=${encodeURIComponent("Código inválido — confira a hora do app e tente de novo.")}`);
  }
  await prisma.user.update({ where: { id: session.userId }, data: { twoFactorSecret: secret, twoFactorEnabled: true } });
  await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "account.2fa_enabled", entityType: "User", entityId: session.userId });
  redirect("/account?ok2fa=on");
}

/** Desativa o 2FA e descarta o segredo. */
export async function disableTwoFactorAction() {
  await ensureDb();
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "account.2fa_disabled", entityType: "User", entityId: session.userId });
  redirect("/account?ok2fa=off");
}

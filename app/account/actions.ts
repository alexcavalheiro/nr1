"use server";

import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { changeOwnPassword, updateOwnProfile } from "@/src/index";
import { createSession, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function updateProfileAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  try {
    const user = await updateOwnProfile(session.userId, str(formData, "name"), str(formData, "email"));
    // Atualiza o nome guardado no cookie de sessão para refletir na UI.
    await createSession({ ...session, name: user.name });
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
  } catch (e) {
    redirect(`/account?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/account?ok=1");
}

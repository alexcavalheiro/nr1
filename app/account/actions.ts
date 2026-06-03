"use server";

import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { changeOwnPassword } from "@/src/index";
import { requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

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

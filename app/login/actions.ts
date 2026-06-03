"use server";

import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { verifyPassword } from "@/src/auth-crypto";
import { createSession } from "../lib/auth";

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
    redirect("/login?error=1");
  }

  await createSession({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    name: user.name,
  });
  redirect("/dashboard");
}

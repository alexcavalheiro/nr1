"use server";

import { redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { verifyPassword } from "@/src/auth-crypto";
import { writeAudit } from "@/src/index";
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
    if (user) await writeAudit({ organizationId: user.memberships[0]?.organizationId, actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, metadata: { email } });
    redirect("/login?error=1");
  }

  await createSession({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    name: user.name,
  });
  await writeAudit({ organizationId: membership.organizationId, actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
  redirect("/dashboard");
}

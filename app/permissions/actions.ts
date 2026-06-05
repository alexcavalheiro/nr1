"use server";

import { revalidatePath } from "next/cache";
import { ensureDb } from "@/src/db";
import { setPermission, writeAudit } from "@/src/index";
import type { Role } from "@prisma/client";
import { canManage, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function setPermissionAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para configurar permissões.");
  const role = str(formData, "role") as Role;
  const module = str(formData, "module");
  const action = str(formData, "action");
  const allowed = str(formData, "allowed") === "true";
  await setPermission(session.organizationId, role, module, action, allowed);
  await writeAudit({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "permission.changed",
    entityType: "RolePermission",
    metadata: { role, module, permAction: action, allowed },
  });
  revalidatePath("/permissions");
}

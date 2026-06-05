import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { ACTIONS, MODULES, RBAC_ROLES, defaultAllow, getPermissionMatrix } from "@/src/index";
import { canManage, requireSession, ROLE_LABEL } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { setPermissionAction } from "./actions";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { role: roleParam } = await searchParams;
  const role = (RBAC_ROLES.includes(roleParam as Role) ? roleParam : RBAC_ROLES[0]) as Role;
  const matrix = await getPermissionMatrix(session.organizationId);

  const isOn = (module: string, action: string) => {
    const v = matrix.get(`${role}|${module}|${action}`);
    return v === undefined ? defaultAllow(role, action) : v;
  };

  return (
    <AppShell session={session} active="permissions" title="Permissões por módulo" subtitle="Configure o que cada perfil pode fazer em cada módulo" showReport={false}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {RBAC_ROLES.map((r) => (
            <Link key={r} href={`/permissions?role=${r}`} className={`badge ${r === role ? "AI" : ""}`} style={{ textDecoration: "none" }}>
              {ROLE_LABEL[r] ?? r}
            </Link>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Editando: <strong>{ROLE_LABEL[role] ?? role}</strong>. Sem configuração explícita, vale o padrão (gestores liberados; Auditor só visualiza).</p>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Módulo</th>{ACTIONS.map((a) => <th key={a.key} style={{ textAlign: "center" }}>{a.label}</th>)}</tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.key}>
                <td><strong>{m.label}</strong></td>
                {ACTIONS.map((a) => {
                  const on = isOn(m.key, a.key);
                  return (
                    <td key={a.key} style={{ textAlign: "center" }}>
                      <form action={setPermissionAction}>
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="module" value={m.key} />
                        <input type="hidden" name="action" value={a.key} />
                        <input type="hidden" name="allowed" value={(!on).toString()} />
                        <button type="submit" className={`badge ${on ? "LOW" : "CRITICAL"}`} style={{ border: "none", cursor: "pointer" }}>
                          {on ? "Permitido" : "Bloqueado"}
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 10 }}>Clique para alternar. A aplicação já usa estas regras na gestão de Usuários; os demais módulos podem ser endurecidos com a mesma checagem.</p>
      </div>
    </AppShell>
  );
}

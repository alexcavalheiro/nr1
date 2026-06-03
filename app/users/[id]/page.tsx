import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { canManage, requireSession, ROLE_LABEL } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { resetPasswordAction, updateMemberAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MemberEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; reset?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const { ok, reset, error } = await searchParams;

  const member = await prisma.membership.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!member) notFound();

  return (
    <AppShell session={session} active="users" title={`Editar ${member.user.name}`} subtitle="Dados do membro e acesso" showReport={false}>
      <p style={{ marginBottom: 16 }}><Link href="/users" className="btn-ghost btn-sm">← Voltar para Usuários</Link></p>
      {ok && <p className="success" style={{ marginBottom: 16 }}>Dados atualizados com sucesso.</p>}
      {reset && <p className="success" style={{ marginBottom: 16 }}>Senha redefinida com sucesso.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
        <h2>Dados do membro</h2>
        <form action={updateMemberAction}>
          <input type="hidden" name="id" value={member.id} />
          <label>Nome</label>
          <input name="name" defaultValue={member.user.name} required />
          <label>E-mail</label>
          <input name="email" type="email" defaultValue={member.user.email} required />
          <label>Cargo</label>
          <input name="jobTitle" defaultValue={member.jobTitle ?? ""} placeholder="Cargo (opcional)" />
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Salvar dados</button>
        </form>
        <p className="hint" style={{ marginTop: 10 }}>Perfil atual: {ROLE_LABEL[member.role] ?? member.role}</p>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h2>Redefinir senha</h2>
        <form action={resetPasswordAction} className="form-row">
          <input type="hidden" name="id" value={member.id} />
          <input type="hidden" name="from" value="detail" />
          <input name="password" type="text" placeholder="Nova senha" minLength={6} required style={{ flex: 1 }} />
          <button className="btn" style={{ width: "auto" }} type="submit">Redefinir</button>
        </form>
        <p className="hint" style={{ marginTop: 10 }}>A senha deve ter ao menos 6 caracteres.</p>
      </div>
    </AppShell>
  );
}

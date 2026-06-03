import { ensureDb, prisma } from "@/src/db";
import { requireSession, ROLE_LABEL } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { changePasswordAction, updateProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; profile?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  const { ok, profile, error } = await searchParams;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });

  return (
    <AppShell session={session} active="account" title="Minha conta" subtitle="Dados de acesso e segurança" showReport={false}>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20, maxWidth: 460 }}>
        <h2>Meus dados</h2>
        {profile && <p className="success" style={{ marginBottom: 12 }}>Dados atualizados com sucesso.</p>}
        <form action={updateProfileAction}>
          <label>Nome</label>
          <input name="name" defaultValue={user?.name ?? session.name} required />
          <label>E-mail</label>
          <input name="email" type="email" defaultValue={user?.email ?? ""} required />
          <p className="stat-label" style={{ margin: "10px 0 2px" }}><strong>Perfil:</strong> {ROLE_LABEL[session.role] ?? session.role}</p>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Salvar dados</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <h2>Alterar senha</h2>
        {ok && <p className="success" style={{ marginBottom: 12 }}>Senha alterada com sucesso.</p>}
        <form action={changePasswordAction}>
          <label>Senha atual</label>
          <input name="current" type="password" required autoComplete="current-password" />
          <label>Nova senha</label>
          <input name="password" type="password" minLength={6} required autoComplete="new-password" />
          <label>Confirmar nova senha</label>
          <input name="confirm" type="password" minLength={6} required autoComplete="new-password" />
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Salvar nova senha</button>
        </form>
        <p className="hint" style={{ marginTop: 10 }}>A senha deve ter ao menos 6 caracteres.</p>
      </div>
    </AppShell>
  );
}

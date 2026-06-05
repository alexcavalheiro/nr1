import { ensureDb, prisma } from "@/src/db";
import { requireSession, ROLE_LABEL } from "../lib/auth";
import { generateTotpSecret, otpauthUri } from "@/src/services/totp.service";
import { AppShell } from "../components/AppShell";
import { changePasswordAction, disableTwoFactorAction, enableTwoFactorAction, updateProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; profile?: string; error?: string; setup2fa?: string; ok2fa?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  const { ok, profile, error, setup2fa, ok2fa } = await searchParams;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true, twoFactorEnabled: true } });

  // Segredo candidato gerado a cada abertura do assistente de configuração.
  const candidateSecret = setup2fa ? generateTotpSecret() : null;

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

      <div className="card" style={{ maxWidth: 460, marginTop: 20 }}>
        <h2>Verificação em duas etapas (2FA)</h2>
        {ok2fa === "on" && <p className="success" style={{ marginBottom: 12 }}>2FA ativado com sucesso.</p>}
        {ok2fa === "off" && <p className="success" style={{ marginBottom: 12 }}>2FA desativado.</p>}

        {user?.twoFactorEnabled ? (
          <>
            <p className="stat-label" style={{ marginBottom: 12 }}>
              <span className="badge LOW">Ativo</span> Seu login exige um código do app autenticador.
            </p>
            <form action={disableTwoFactorAction}>
              <button className="btn-ghost" type="submit">Desativar 2FA</button>
            </form>
          </>
        ) : candidateSecret ? (
          <>
            <p className="stat-label" style={{ marginBottom: 8 }}>1. Adicione esta chave ao Google Authenticator, Authy ou 1Password:</p>
            <code style={{ display: "block", padding: 10, background: "var(--surface-2, #f4f4f5)", borderRadius: 8, wordBreak: "break-all", marginBottom: 8 }}>{candidateSecret}</code>
            <p className="hint" style={{ marginBottom: 12, wordBreak: "break-all" }}>URI: {otpauthUri(candidateSecret, user?.email ?? session.name)}</p>
            <form action={enableTwoFactorAction}>
              <input type="hidden" name="secret" value={candidateSecret} />
              <label>2. Digite o código de 6 dígitos gerado</label>
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus />
              <button className="btn" type="submit" style={{ marginTop: 12 }}>Ativar 2FA</button>
            </form>
          </>
        ) : (
          <>
            <p className="stat-label" style={{ marginBottom: 12 }}>
              <span className="badge">Inativo</span> Reforce a segurança exigindo um código além da senha.
            </p>
            <a className="btn" href="/account?setup2fa=1">Configurar 2FA</a>
          </>
        )}
      </div>
    </AppShell>
  );
}

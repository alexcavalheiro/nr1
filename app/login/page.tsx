import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand"><span className="brand-mark">NR</span> Plataforma NR-1</div>
        <h1>Bem-vindo de volta</h1>
        <p className="stat-label">Saúde Organizacional e Conformidade NR-1</p>
        {error === "expired" && <p className="error">Seu acesso expirou. Procure o gestor para renovar.</p>}
        {error === "suspended" && <p className="error">Acesso suspenso. Empresa inativa — fale com o provedor da plataforma.</p>}
        {error && error !== "expired" && error !== "suspended" && <p className="error">Credenciais inválidas.</p>}
        <form action={login}>
          <label>E-mail</label>
          <input name="email" type="email" defaultValue="admin@acme.com" required />
          <label>Senha</label>
          <input name="password" type="password" defaultValue="admin123" required />
          <button className="btn" type="submit">Entrar</button>
        </form>
        <p className="hint">Acesso de demonstração: admin@acme.com · admin123</p>
      </div>
    </div>
  );
}

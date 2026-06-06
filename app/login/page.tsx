import { ensureDb, prisma } from "@/src/db";
import { buildThemeCss } from "../components/AppShell";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; c?: string }>;
}) {
  const { error, c } = await searchParams;

  // Login com a marca do cliente quando acessado via /login?c=<id do cliente>.
  let brand: { name: string; logoUrl: string | null; themeCss: string } | null = null;
  if (c) {
    await ensureDb();
    const org = await prisma.organization.findUnique({
      where: { id: c },
      select: { name: true, logoUrl: true, brandColor: true, accentColor: true, theme: true, corners: true, active: true },
    });
    if (org && org.active) brand = { name: org.name, logoUrl: org.logoUrl, themeCss: buildThemeCss(org) };
  }

  return (
    <div className="login-wrap">
      {brand?.themeCss && <style dangerouslySetInnerHTML={{ __html: brand.themeCss }} />}
      <div className="card login-card">
        <div className="brand">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} style={{ maxHeight: 40, maxWidth: 180, objectFit: "contain" }} />
          ) : (
            <><span className="brand-mark">NR</span> Plataforma NR-1</>
          )}
        </div>
        <h1>{brand ? `Acessar ${brand.name}` : "Bem-vindo de volta"}</h1>
        <p className="stat-label">Saúde Organizacional e Conformidade NR-1</p>
        {error === "expired" && <p className="error">Seu acesso expirou. Procure o gestor para renovar.</p>}
        {error === "suspended" && <p className="error">Acesso suspenso. Empresa inativa — fale com o provedor da plataforma.</p>}
        {error && error !== "expired" && error !== "suspended" && <p className="error">Credenciais inválidas.</p>}
        <form action={login}>
          <label>E-mail</label>
          <input name="email" type="email" defaultValue={brand ? "" : "admin@acme.com"} required />
          <label>Senha</label>
          <input name="password" type="password" defaultValue={brand ? "" : "admin123"} required />
          <button className="btn" type="submit">Entrar</button>
        </form>
        {!brand && <p className="hint">Acesso de demonstração: admin@acme.com · admin123</p>}
      </div>
    </div>
  );
}

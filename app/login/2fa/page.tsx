import { redirect } from "next/navigation";
import { getPending2fa } from "../../lib/auth";
import { verifyTwoFactor } from "../actions";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const pending = await getPending2fa();
  if (!pending) redirect("/login");
  const { error } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand"><span className="brand-mark">NR</span> Plataforma NR-1</div>
        <h1>Verificação em duas etapas</h1>
        <p className="stat-label">Digite o código de 6 dígitos do seu app autenticador.</p>
        {error && <p className="error">Código inválido ou expirado. Tente novamente.</p>}
        <form action={verifyTwoFactor}>
          <label>Código TOTP</label>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus />
          <button className="btn" type="submit">Confirmar</button>
        </form>
        <p className="hint">O código muda a cada 30 segundos.</p>
      </div>
    </div>
  );
}

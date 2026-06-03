import { NextResponse, type NextRequest } from "next/server";

// Camada de proteção de rotas (Next 16 "proxy", antigo middleware): exige cookie
// de sessão nas áreas internas. A verificação completa (assinatura + papel)
// acontece em cada página/ação.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("nr1_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/learning/:path*", "/hub/:path*", "/risks/:path*", "/surveys/:path*",
    "/listening/:path*", "/monitoring/:path*", "/documents/:path*", "/assistant/:path*",
    "/automations/:path*", "/integrations/:path*", "/privacy/:path*", "/users/:path*",
  ],
};

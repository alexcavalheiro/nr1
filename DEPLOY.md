# Guia de Deploy — Supabase (banco) + Vercel (hospedagem)

Passo a passo completo, em português, para colocar a Plataforma NR-1 no ar.
Sem servidor próprio: o **Supabase** cuida do banco de dados e a **Vercel**
hospeda a aplicação.

> Tempo estimado: 20–30 minutos na primeira vez.
>
> ⚠️ Eu (assistente) deixo o **código** 100% pronto, mas **não consigo** criar as
> contas nem clicar nos botões por você — isso exige o seu login na Supabase e na
> Vercel. Siga os passos abaixo.

```
GitHub (código)  ──►  Vercel (site no ar)  ──►  Supabase (banco de dados)
```

A app já está preparada: em dev usa **PGlite** (Postgres em WASM, sem instalar
nada); em produção, basta apontar `DATABASE_URL` para um Postgres real — o código
detecta sozinho e desliga o PGlite. Nenhuma linha precisa mudar.

---

## Parte 1 — Criar o banco no Supabase

1. Acesse https://supabase.com e crie uma conta (pode entrar com o GitHub).
2. Clique em **New project**.
3. Preencha:
   - **Name:** `nr1` (ou o nome que preferir)
   - **Database Password:** crie uma senha forte e **anote** (vai precisar dela).
   - **Region:** escolha **South America (São Paulo)** se aparecer.
4. Clique em **Create new project** e espere ~2 minutos.
5. Vá em **Settings** (engrenagem) → **Database** → **Connection string** → aba **URI**.
6. Você vai precisar de **duas** versões dessa string:
   - **Direta** (porta `5432`) — para aplicar o schema:
     ```
     postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres
     ```
   - **Pooler** (porta `6543`) — para a app rodar. Pegue a string do pooler e
     acrescente ao final: `?pgbouncer=true&connection_limit=1`
     ```
     postgresql://postgres:[SENHA]@db.[REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
     ```
7. Em ambas, substitua `[SENHA]` pela senha que você criou no passo 3.

➡️ **Guarde as duas strings.** A do pooler será o `DATABASE_URL` na Vercel.

> Por que duas? O pooler (6543) aguenta muitas conexões simultâneas (ideal para o
> site). A direta (5432) é necessária para criar/alterar tabelas.

---

## Parte 2 — Gerar o segredo de sessão

O sistema assina os cookies de login com um segredo. Gere um valor aleatório:

- **Mac/Linux** (Terminal):
  ```bash
  openssl rand -hex 32
  ```
- **Windows** (PowerShell):
  ```powershell
  -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  ```

➡️ Copie o resultado. Ele é o seu `SESSION_SECRET`.

---

## Parte 3 — Aplicar o schema no Supabase

No seu computador, dentro da pasta do projeto, rode (use a string **direta**, 5432):

```bash
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" npm run db:deploy
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" npm run db:seed
```

- `db:deploy` cria todas as tabelas no Supabase.
- `db:seed` cria os dados de referência + o tenant demo
  (login `admin@acme.com` / `admin123`).

> No Windows (cmd/PowerShell), defina a variável antes do comando, ex.:
> `set DATABASE_URL=...` (cmd) ou `$env:DATABASE_URL="..."` (PowerShell).

---

## Parte 4 — Subir o código para o GitHub

Se ainda não estiver no GitHub:

```bash
git add -A && git commit -m "Plataforma NR-1"
git push -u origin main
```

> A Vercel publica a branch **`main`** por padrão. Se o seu trabalho está em outra
> branch, mergeie para a `main` **ou** troque a branch de produção em
> **Vercel → Settings → Git → Production Branch**.

---

## Parte 5 — Deploy na Vercel

1. Acesse https://vercel.com e entre com o **GitHub**.
2. Clique em **Add New… → Project** e **Import** o repositório `nr1`.
3. A Vercel detecta **Next.js** sozinha. **Não clique em Deploy ainda.**
4. Abra **Environment Variables** e adicione:

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | a string do **pooler** (porta 6543, com `?pgbouncer=true&connection_limit=1`) |
   | `SESSION_SECRET` | o valor aleatório (Parte 2) |
   | `ANTHROPIC_API_KEY` | *(opcional)* sua chave da Anthropic, para o copiloto com IA real |

5. O **Build Command** já vem certo (`npm run vercel-build` — roda
   `prisma generate` + `deploy.mjs` + `next build`).
6. Clique em **Deploy**.

Ao final, você recebe uma URL tipo `https://nr1-xxxx.vercel.app`, que já abre na
tela de login.

---

## Parte 6 — Primeiro acesso

O sistema cria o administrador do provedor automaticamente:

- **E-mail:** `super@nr1.com`
- **Senha:** `super123`

> ⚠️ **Troque a senha imediatamente** após o primeiro login, em Perfil/Segurança.

A partir daí, você cria os clientes (empresas) pelo Painel do Provedor.

---

## Atualizações futuras

Todo `git push` para a branch de produção dispara um novo deploy automático na
Vercel. As mudanças de schema:

- Em dev: `npm run db:migrate` gera a migration.
- No deploy: a Vercel aplica automaticamente (as migrations são idempotentes —
  só aplicam o que ainda falta).

---

## Custos

| Serviço | Plano gratuito | Plano pago (uso comercial) |
|---------|----------------|----------------------------|
| Supabase | 500 MB de banco | Pro ~US$ 25/mês |
| Vercel | Hobby (projetos pessoais) | Pro ~US$ 20/mês |

Para testar/validar, o gratuito dos dois já funciona (**R$ 0**). Para clientes
pagantes, migre para os planos Pro.

---

## Resolução de problemas

- **Build falha em "prisma generate":** confirme que `DATABASE_URL` está nas
  variáveis de ambiente da Vercel.
- **"Can't reach database server":** a senha dentro da `DATABASE_URL` está errada,
  ou você esqueceu de substituir `[SENHA]`.
- **Site abre mas dá erro de login:** faltou definir `SESSION_SECRET`.
- **Muitas conexões / timeout:** confira se está usando a string do **pooler**
  (6543) com `?pgbouncer=true&connection_limit=1`, não a direta.
- **Quero rodar local de novo:** apague `DATABASE_URL` do `.env` local — o sistema
  volta a usar o PGlite. Para zerar o banco local: `rm -rf .pglite`.

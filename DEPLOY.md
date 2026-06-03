# Deploy — Supabase (banco) + Vercel (hospedagem)

A app já está pronta para produção. Em dev ela usa **PGlite** (sem instalar nada);
em produção, basta apontar `DATABASE_URL` para um Postgres real (Supabase) — o código
detecta automaticamente e desliga o PGlite.

> Eu (assistente) **não consigo** criar as contas nem fazer o deploy por você — isso
> exige seu login na Supabase e na Vercel. Os passos abaixo levam ~10 minutos.

---

## 1. Banco no Supabase

1. Crie um projeto em https://supabase.com (anote a senha do banco).
2. Em **Project Settings → Database → Connection string → URI**, copie a string.
   - Para a app, prefira a connection string do **pooler** (porta `6543`), adicionando
     `?pgbouncer=true&connection_limit=1` ao final.
   - Guarde também a string **direta** (porta `5432`) para rodar as migrations.

## 2. Subir o código para o GitHub

```bash
cd ~/Desktop/plataforma-nr1
git add -A && git commit -m "Plataforma NR-1"
# crie um repositório vazio no GitHub e:
git remote add origin https://github.com/SEU_USUARIO/plataforma-nr1.git
git push -u origin main
```

## 3. Aplicar o schema no Supabase

```bash
# use a string DIRETA (porta 5432) aqui:
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" npm run db:deploy
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" npm run db:seed
```

O `db:seed` cria os dados de referência + o tenant demo (login `admin@acme.com` / `admin123`).

## 4. Deploy na Vercel

1. Em https://vercel.com → **Add New → Project**, importe o repositório do GitHub.
2. **Build Command:** `npm run vercel-build` (já roda `prisma generate` + `migrate deploy` + `next build`).
3. **Environment Variables:**
   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string do **pooler** (porta 6543, com `?pgbouncer=true&connection_limit=1`) |
   | `SESSION_SECRET` | algo aleatório (`openssl rand -hex 32`) |
   | `ANTHROPIC_API_KEY` | (opcional) ativa o Copiloto com IA generativa |
4. **Deploy.** Pronto — a URL da Vercel já abre na tela de login.

---

## Observações
- Trocar o PGlite por Postgres é só a variável `DATABASE_URL`; nenhum código muda.
- Migrations já versionadas em `prisma/migrations/`. Novas mudanças de schema:
  `npm run db:migrate` em dev gera a migration; a Vercel aplica no deploy.
- Para zerar o ambiente local de dev: `rm -rf .pglite`.

# Plataforma Integrada de Saúde Organizacional e Conformidade NR-1

Plataforma SaaS multi-tenant para gestão dos riscos psicossociais exigidos pela
NR-1: diagnóstico organizacional, educação socioemocional, gestão e priorização
de riscos, planos de ação, monitoramento, compliance, auditoria e IA.

## Stack

- **Prisma 6** + **PostgreSQL** (camada de dados)
- TypeScript + tsx (scripts/seed)

## Estrutura

```
prisma/
  schema.prisma     # modelo de dados completo (8 módulos + Hub + Escuta + LGPD + IA)
  seed.ts           # categorias de risco, política LGPD e agentes de IA padrão
  migrations/       # migration inicial (00000000000000_init)
docs/
  er-diagram.md     # diagrama ER (Mermaid)
```

## Rodar o app (Next.js)

Roda sem instalar Postgres — usa PGlite (Postgres em WASM) persistido em `.pglite`,
com migration + seed do tenant de demonstração aplicados no primeiro acesso:

```bash
npm install
npm run dev      # http://localhost:3000
```

Login de demonstração: **admin@acme.com / admin123**. Telas disponíveis:
- **Dashboard** — heatmap, ranking, alertas, insights de IA e resumo executivo.
- **Riscos** — inventário, criar risco, e no detalhe: avaliar (matriz prob×impacto),
  priorizar (5 critérios) e gerir planos de ação (criar → avançar status → comentar).
- **Pesquisas** — criar pesquisa, montar questionário (perguntas mapeadas a riscos),
  publicar, responder e **derivar riscos** das respostas (alimenta o inventário).
- **Escuta ativa** — canal de manifestações (denúncia/sugestão/ajuda/reconhecimento)
  com envio anônimo; gestores tratam (status, responsável) e **geram riscos** rastreáveis.
- **Monitoramento** — indicadores (clima, engajamento, rotatividade…) com variação,
  motor de verificação que **gera alertas** (plano vencido, queda de engajamento) e resolução.
- **Documentos (GRO)** — exporta o Inventário de Riscos em **CSV/Excel (.xlsx)** e gera o
  **Relatório NR-1** consolidado (página imprimível → PDF), com histórico de documentos.

Escritas são restritas por perfil (`canManage`: Gestor/RH/Consultor/Super Admin);
demais perfis têm acesso de leitura. Tudo isolado por organização (multi-tenant).

**Produção / Postgres real:** defina `DATABASE_URL=postgresql://...` (o app passa
a usar Postgres em vez do PGlite) e rode `npm run db:deploy && npm run db:seed`.

## Setup

```bash
# 1. dependências
npm install

# 2. configurar conexão ao Postgres
cp .env.example .env        # e ajuste DATABASE_URL

# 3. aplicar o schema ao banco
npm run db:migrate          # cria as tabelas (dev)
#   ou, em produção:  npm run db:deploy

# 4. popular dados de referência
npm run db:seed

# 5. explorar os dados
npm run db:studio
```

## Demo end-to-end (sem instalar banco)

Roda a plataforma inteira contra um Postgres em WASM (PGlite), em memória —
pesquisa → respostas → derivação de risco → avaliação crítica → automação
dispara alerta + plano de ação automaticamente:

```bash
npm run demo      # ciclo do risco (M2→M8): pesquisa → risco crítico → automação
npm run demo:ai   # worker de IA: agentes geram insights + resumo executivo
```

## Camada de serviços (`src/`)

Domínio framework-agnóstico — pluga em server actions do Next ou rotas REST:

```
src/domain/scoring.ts            # funções puras: score, classificação, priorização
src/services/events.ts           # motor de eventos → automações + webhooks (n8n)
src/services/risk.service.ts     # criar/avaliar risco + heatmap
src/services/prioritization.service.ts
src/services/survey.service.ts   # pesquisas versionadas → derivação de riscos
src/services/ai/                 # agentes de IA: analyzer + LLM plugável + insights/resumos
```

## Scripts

| Comando | Ação |
|---|---|
| `npm run db:generate` | gera o Prisma Client |
| `npm run db:migrate`  | cria/aplica migrations (dev) |
| `npm run db:deploy`   | aplica migrations (produção) |
| `npm run db:seed`     | semeia dados de referência |
| `npm run db:studio`   | abre o Prisma Studio |
| `npm run db:reset`    | reseta o banco e re-semeia |

## Mapa dos módulos → modelos

| Módulo NR-1 | Modelos principais |
|---|---|
| 1 · Socioemocional | `LearningTrack`, `LearningContent`, `ContentProgress` |
| 2 · Identificação | `Survey`, `SurveyVersion`, `SurveyQuestion`, `SurveyResponse`, `RiskCategory`, `Risk`, `RiskSource` |
| 3 · Avaliação | `RiskAssessment`, `RiskMatrixConfig` |
| 4 · Priorização | `RiskPrioritization` |
| 5 · Controle | `ActionPlan`, `ActionEvidence`, `ActionComment` |
| 6 · Monitoramento | `IndicatorSnapshot`, `Alert` |
| 7 · Documentação | `GeneratedDocument`, `AuditLog` |
| Hub de convivência | `FeedPost`, `Campaign`, `Notification` |
| Escuta ativa | `Manifestation` |
| LGPD | `ConsentPolicy`, `Consent`, `DataSubjectRequest` |
| 8 · IA e automações | `Integration`, `SystemEvent`, `AutomationFlow`, `AutomationAction`, `AutomationRun`, `WebhookEndpoint`, `WebhookDelivery`, `AiAgent`, `AiConversation`, `AiMessage`, `AiInsight`, `ExecutiveSummary` |

Ver o diagrama completo em [`docs/er-diagram.md`](docs/er-diagram.md).

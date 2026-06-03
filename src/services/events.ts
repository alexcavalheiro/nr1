import {
  AlertType,
  AutomationActionType,
  Prisma,
  RiskLevel,
  RunStatus,
  SystemEventType,
} from "@prisma/client";
import { createHmac } from "node:crypto";
import { prisma } from "../db";

// =============================================================================
// MOTOR DE EVENTOS (Módulo 8)
// emitEvent → grava SystemEvent → dispatch:
//   1. dispara AutomationFlows cujo trigger casa (e cujas condições batem),
//      executando cada AutomationAction via um handler registrado;
//   2. enfileira WebhookDelivery para cada endpoint que assina o evento.
// A entrega HTTP real dos webhooks fica para um worker (lê deliveries PENDING).
// =============================================================================

export interface EmitEventInput {
  organizationId: string;
  type: SystemEventType;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

export async function emitEvent(input: EmitEventInput) {
  const event = await prisma.systemEvent.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
  await dispatch(event.id);
  return event;
}

async function dispatch(eventId: string) {
  const event = await prisma.systemEvent.findUniqueOrThrow({ where: { id: eventId } });
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  // 1. Automações ------------------------------------------------------------
  const flows = await prisma.automationFlow.findMany({
    where: { organizationId: event.organizationId, triggerEvent: event.type, enabled: true },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  for (const flow of flows) {
    if (!matchesConditions(flow.conditions, payload)) continue;

    const run = await prisma.automationRun.create({
      data: { flowId: flow.id, eventId: event.id, status: RunStatus.RUNNING, input: event.payload ?? {} },
    });

    try {
      const results: unknown[] = [];
      for (const action of flow.actions) {
        const handler = ACTION_HANDLERS[action.type];
        results.push(
          await handler({
            organizationId: event.organizationId,
            payload,
            config: (action.config ?? {}) as Record<string, unknown>,
            eventType: event.type,
          }),
        );
      }
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: RunStatus.SUCCESS, output: results as Prisma.InputJsonValue, finishedAt: new Date() },
      });
    } catch (err) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: RunStatus.FAILED, error: String(err), finishedAt: new Date() },
      });
    }
  }

  // 2. Webhooks (n8n / Zapier / Make) ----------------------------------------
  // Endpoints por org são poucos: filtra a assinatura em memória (evita o filtro
  // `has` sobre array de enum, problemático em alguns drivers/adapters).
  const endpoints = (
    await prisma.webhookEndpoint.findMany({
      where: { organizationId: event.organizationId, active: true },
    })
  ).filter((e) => e.events.includes(event.type));
  for (const endpoint of endpoints) {
    await deliverWebhook(endpoint, event);
  }

  await prisma.systemEvent.update({ where: { id: event.id }, data: { dispatchedAt: new Date() } });
}

/** Entrega o evento via HTTP ao endpoint assinado (best-effort, timeout 5s). */
async function deliverWebhook(
  endpoint: { id: string; url: string; secret: string | null },
  event: { id: string; type: SystemEventType; organizationId: string; entityType: string | null; entityId: string | null; payload: Prisma.JsonValue },
) {
  const body = JSON.stringify({
    id: event.id, type: event.type, organizationId: event.organizationId,
    entityType: event.entityType, entityId: event.entityId, payload: event.payload, at: new Date().toISOString(),
  });
  const headers: Record<string, string> = { "content-type": "application/json", "x-nr1-event": event.type };
  if (endpoint.secret) headers["x-nr1-signature"] = createHmac("sha256", endpoint.secret).update(body).digest("hex");

  let status: RunStatus = RunStatus.SUCCESS;
  let responseCode: number | undefined;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(endpoint.url, { method: "POST", headers, body, signal: ctrl.signal });
    clearTimeout(timer);
    responseCode = res.status;
    if (!res.ok) status = RunStatus.FAILED;
  } catch {
    status = RunStatus.FAILED;
  }
  await prisma.webhookDelivery.create({
    data: { endpointId: endpoint.id, eventId: event.id, status, responseCode, attempts: 1, payload: event.payload ?? {} },
  });
}

/** Condições simples: igualdade chave-a-chave entre conditions e o payload. */
function matchesConditions(conditions: Prisma.JsonValue | null, payload: Record<string, unknown>): boolean {
  if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) return true;
  return Object.entries(conditions as Record<string, unknown>).every(([k, v]) => payload[k] === v);
}

// -----------------------------------------------------------------------------
// Registro de handlers de ação. Reaproveitam os modelos já existentes:
// criar plano = ActionPlan, alerta = Alert, auditoria = AuditLog, etc.
// -----------------------------------------------------------------------------
interface ActionContext {
  organizationId: string;
  payload: Record<string, unknown>;
  config: Record<string, unknown>;
  eventType: SystemEventType;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const ACTION_HANDLERS: Record<AutomationActionType, (ctx: ActionContext) => Promise<unknown>> = {
  async SEND_ALERT(ctx) {
    const alert = await prisma.alert.create({
      data: {
        organizationId: ctx.organizationId,
        type: (str(ctx.config.alertType) as AlertType) ?? AlertType.CRITICAL_RISK,
        severity: (str(ctx.payload.classification) as RiskLevel) ?? RiskLevel.MODERATE,
        title: str(ctx.config.title) ?? "Alerta automático",
        message: str(ctx.payload.title),
        relatedRiskId: str(ctx.payload.riskId),
      },
    });
    return { action: "SEND_ALERT", alertId: alert.id };
  },

  async CREATE_ACTION_PLAN(ctx) {
    const riskId = str(ctx.payload.riskId);
    const plan = await prisma.actionPlan.create({
      data: {
        organizationId: ctx.organizationId,
        riskId,
        title: str(ctx.config.title) ?? `Plano de ação — ${str(ctx.payload.title) ?? "risco identificado"}`,
        ownerId: str(ctx.config.ownerId),
      },
    });
    return { action: "CREATE_ACTION_PLAN", actionPlanId: plan.id };
  },

  async WRITE_AUDIT_LOG(ctx) {
    const log = await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        action: str(ctx.config.action) ?? `event.${ctx.eventType.toLowerCase()}`,
        entityType: str(ctx.payload.entityType) ?? "SystemEvent",
        entityId: str(ctx.payload.entityId),
        metadata: ctx.payload as Prisma.InputJsonValue,
      },
    });
    return { action: "WRITE_AUDIT_LOG", auditLogId: log.id };
  },

  async REGISTER_INCIDENT(ctx) {
    const log = await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        action: "incident.registered",
        entityType: str(ctx.payload.entityType) ?? "Manifestation",
        entityId: str(ctx.payload.entityId),
        metadata: ctx.payload as Prisma.InputJsonValue,
      },
    });
    return { action: "REGISTER_INCIDENT", auditLogId: log.id };
  },

  async NOTIFY_HR(ctx) {
    return notify(ctx, "RH notificado");
  },
  async NOTIFY_MANAGER(ctx) {
    return notify(ctx, "Gestor notificado");
  },

  async TRIGGER_AI_AGENT(ctx) {
    // Cria um insight-placeholder; o agente real é acionado por um worker de IA.
    const insight = await prisma.aiInsight.create({
      data: {
        organizationId: ctx.organizationId,
        type: "RISK_DETECTION",
        summary: `Análise solicitada para evento ${ctx.eventType}`,
        relatedRiskId: str(ctx.payload.riskId),
        detail: ctx.payload as Prisma.InputJsonValue,
      },
    });
    return { action: "TRIGGER_AI_AGENT", insightId: insight.id, queued: true };
  },

  // Ações que dependem de integração externa / UI — enfileiradas, não no-op.
  async CLASSIFY(ctx) {
    return { action: "CLASSIFY", queued: true, target: str(ctx.config.target) };
  },
  async CREATE_PROTOCOL(ctx) {
    return { action: "CREATE_PROTOCOL", queued: true, ref: str(ctx.payload.entityId) };
  },
  async ESCALATE(ctx) {
    return { action: "ESCALATE", queued: true, to: str(ctx.config.escalateTo) };
  },
  async UPDATE_DASHBOARD() {
    return { action: "UPDATE_DASHBOARD", queued: true };
  },
  async CALL_WEBHOOK(ctx) {
    return { action: "CALL_WEBHOOK", queued: true, url: str(ctx.config.url) };
  },
  async CALL_INTEGRATION(ctx) {
    return { action: "CALL_INTEGRATION", queued: true, provider: str(ctx.config.provider) };
  },
};

async function notify(ctx: ActionContext, title: string) {
  const n = await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      title,
      body: str(ctx.payload.title),
      userId: str(ctx.config.userId),
    },
  });
  return { action: "NOTIFY", notificationId: n.id };
}

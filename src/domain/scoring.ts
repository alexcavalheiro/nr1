import { RiskLevel } from "@prisma/client";

// =============================================================================
// Funções PURAS de cálculo da NR-1. Sem I/O — fáceis de testar isoladamente.
// =============================================================================

/** Faixas de corte do score (probabilidade × impacto, 1..25) → classificação. */
export interface RiskMatrix {
  lowMax: number; // <= => LOW
  moderateMax: number; // <= => MODERATE
  highMax: number; // <= => HIGH; acima => CRITICAL
}

/** Matriz 5×5 padrão (espelha os defaults de RiskMatrixConfig). */
export const DEFAULT_RISK_MATRIX: RiskMatrix = {
  lowMax: 4,
  moderateMax: 9,
  highMax: 16,
};

const SCALE_MIN = 1;
const SCALE_MAX = 5;

/** Garante que um valor está na escala NR-1 de 1..5. Lança se inválido. */
export function assertScale(value: number, field: string): void {
  if (!Number.isInteger(value) || value < SCALE_MIN || value > SCALE_MAX) {
    throw new RangeError(`${field} deve ser inteiro entre ${SCALE_MIN} e ${SCALE_MAX} (recebido: ${value}).`);
  }
}

/** Score da avaliação (Módulo 3): probabilidade × impacto, ambos 1..5 → 1..25. */
export function assessmentScore(probability: number, impact: number): number {
  assertScale(probability, "probability");
  assertScale(impact, "impact");
  return probability * impact;
}

/** Classifica o score na matriz da organização (Baixo/Moderado/Alto/Crítico). */
export function classifyByScore(score: number, matrix: RiskMatrix = DEFAULT_RISK_MATRIX): RiskLevel {
  if (score <= matrix.lowMax) return RiskLevel.LOW;
  if (score <= matrix.moderateMax) return RiskLevel.MODERATE;
  if (score <= matrix.highMax) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

// -----------------------------------------------------------------------------
// Priorização (Módulo 4): composto ponderado dos 5 critérios (cada um 1..5).
// Pesos somam 1 → resultado permanece na escala 1..5 (comparável e explicável).
// -----------------------------------------------------------------------------
export interface PriorityCriteria {
  severity: number;
  frequency: number;
  financialImpact: number;
  humanImpact: number;
  legalImpact: number;
}

export const PRIORITY_WEIGHTS: Record<keyof PriorityCriteria, number> = {
  severity: 0.3,
  humanImpact: 0.25,
  legalImpact: 0.2,
  frequency: 0.15,
  financialImpact: 0.1,
};

/** Score composto de priorização (1..5), arredondado a 2 casas. */
export function priorityScore(c: PriorityCriteria): number {
  (Object.keys(PRIORITY_WEIGHTS) as (keyof PriorityCriteria)[]).forEach((k) => assertScale(c[k], k));
  const raw =
    c.severity * PRIORITY_WEIGHTS.severity +
    c.humanImpact * PRIORITY_WEIGHTS.humanImpact +
    c.legalImpact * PRIORITY_WEIGHTS.legalImpact +
    c.frequency * PRIORITY_WEIGHTS.frequency +
    c.financialImpact * PRIORITY_WEIGHTS.financialImpact;
  return Math.round(raw * 100) / 100;
}

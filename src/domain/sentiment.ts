import { RiskLevel, SentimentLabel } from "@prisma/client";

// =============================================================================
// Funções PURAS de sentimento/severidade (sem I/O). Convenção de score: 0..1,
// onde 0 = péssimo e 1 = ótimo (clima saudável).
// =============================================================================

/** Converte a média de uma escala Likert 1..5 num score 0..1. */
export function likertToScore(avg: number): number {
  return Math.max(0, Math.min(1, (avg - 1) / 4));
}

/** Classifica um score 0..1 em rótulo de sentimento. */
export function classifySentiment(score: number): SentimentLabel {
  if (score < 0.25) return SentimentLabel.CRITICAL;
  if (score < 0.5) return SentimentLabel.NEGATIVE;
  if (score < 0.75) return SentimentLabel.NEUTRAL;
  return SentimentLabel.POSITIVE;
}

/** Severidade de risco derivada de um score 0..1 (quanto menor, pior). */
export function scoreToSeverity(score: number): RiskLevel {
  if (score < 0.25) return RiskLevel.CRITICAL;
  if (score < 0.5) return RiskLevel.HIGH;
  if (score < 0.75) return RiskLevel.MODERATE;
  return RiskLevel.LOW;
}

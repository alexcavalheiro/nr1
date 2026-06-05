// API pública da camada de serviços — pluga em server actions do Next ou rotas REST.
export { prisma } from "./db";

export * from "./domain/scoring";
export * from "./domain/sentiment";

export { emitEvent } from "./services/events";
export { writeAudit, listAuditLogs, auditStats, accessDashboard } from "./services/audit.service";
export {
  MODULES, ACTIONS, RBAC_ROLES, defaultAllow, getPermissionMatrix, isAllowed,
  requirePermission, setPermission,
} from "./services/permission.service";
export { createRisk, assessRisk, getHeatmap, listRisks, getRiskDetail, updateRisk, deleteRisk } from "./services/risk.service";
export { prioritizeRisk, recomputeRanking, getRanking } from "./services/prioritization.service";
export { createActionPlan, advanceActionPlan, addActionComment, addActionEvidence } from "./services/actionplan.service";
export {
  createManifestation,
  listManifestations,
  getManifestationDetail,
  updateManifestationStatus,
  assignManifestation,
  createRiskFromManifestation,
} from "./services/manifestation.service";
export {
  recordIndicator,
  getIndicators,
  getAlerts,
  resolveAlert,
  runMonitoringChecks,
} from "./services/monitoring.service";
export {
  buildRiskInventory,
  buildNr1Report,
  toCsv,
  recordGeneratedDocument,
  listGeneratedDocuments,
  addManualDocument,
  updateManualDocument,
  deleteDocument,
} from "./services/documents.service";
export {
  listMembers,
  createMember,
  updateMemberProfile,
  updateOwnProfile,
  updateMemberRole,
  setMemberActive,
  changeOwnPassword,
  resetMemberPassword,
} from "./services/user.service";
export {
  listFlows,
  createFlow,
  getFlowDetail,
  addAction,
  removeAction,
  toggleFlow,
} from "./services/automation.service";
export { listTracks, createTrack, addContent, markContentComplete } from "./services/learning.service";
export { listFeed, createPost, updatePost, deletePost } from "./services/hub.service";
export {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  listWebhooks,
  createWebhook,
  deleteWebhook,
} from "./services/integration.service";
export {
  getActivePolicies,
  getMyConsents,
  grantConsent,
  revokeConsent,
  createDataRequest,
  listMyDataRequests,
  listOrgDataRequests,
  setDataRequestStatus,
} from "./services/privacy.service";
export {
  createSurvey,
  addQuestions,
  publishVersion,
  submitResponse,
  deriveRisksFromSurvey,
  listSurveys,
  getSurveyDetail,
  getSurveyForResponse,
  updateSurvey,
  deleteSurvey,
} from "./services/survey.service";
export {
  runOrgHealthAgent,
  runExecutiveAgent,
  labelSurveySentiments,
} from "./services/ai/agent.service";
export type { LlmClient, LlmMessage } from "./services/ai/llm";
export { getLlmClient, TemplateLlmClient, ClaudeLlmClient, hasRealLlm } from "./services/ai/llm";
export { answerQuestion, getConversation, sendAssistantMessage } from "./services/ai/assistant.service";

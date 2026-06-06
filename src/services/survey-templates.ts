import type { QuestionType, SurveyType } from "@prisma/client";
import type { QuestionInput } from "./survey.service";

// =============================================================================
// BANCO DE MODELOS DE PESQUISA (diagnóstico de clima, saúde mental e riscos
// psicossociais). Cada modelo é um conjunto de blocos com perguntas já
// dimensionadas e com pontuação reversa marcada.
// =============================================================================

type Q = {
  text: string;
  type: QuestionType;
  dimension?: string;
  reverse?: boolean;
  sensitive?: boolean;
  options?: string[];
  required?: boolean;
};
type Block = { section: string; questions: Q[] };
export interface SurveyTemplate {
  key: string;
  title: string;
  description: string;
  type: SurveyType;
  blocks: Block[];
}

const L = "LIKERT_5" as QuestionType;
const C = "SINGLE_CHOICE" as QuestionType;
const M = "MULTIPLE_CHOICE" as QuestionType;
const T = "OPEN_TEXT" as QuestionType;
const S10 = "SCALE_0_10" as QuestionType;

// ---- Blocos reutilizáveis -------------------------------------------------
const blocoPerfil: Block = {
  section: "Perfil Organizacional",
  questions: [
    { text: "Setor", type: T, required: false },
    { text: "Cargo", type: T, required: false },
    { text: "Tempo de empresa", type: C, required: false, options: ["Menos de 1 ano", "1 a 3 anos", "3 a 5 anos", "Mais de 5 anos"] },
    { text: "Faixa etária (opcional)", type: C, required: false, options: ["Até 25", "26 a 35", "36 a 45", "46 a 55", "Acima de 55"] },
  ],
};
const blocoPulso: Block = {
  section: "Pulso Emocional",
  questions: [
    { text: "Como você está se sentindo hoje em relação ao trabalho?", type: C, dimension: "pulso", options: ["Muito bem", "Bem", "Neutro", "Desanimado", "Sobrecarregado", "Exausto"] },
  ],
};
const blocoBemEstar: Block = {
  section: "Saúde Mental e Bem-Estar",
  questions: [
    { text: "Sinto que minha saúde emocional está preservada no ambiente de trabalho.", type: L, dimension: "bem_estar" },
    { text: "Consigo equilibrar minha vida pessoal e profissional.", type: L, dimension: "bem_estar" },
    { text: "Tenho conseguido descansar adequadamente fora do trabalho.", type: L, dimension: "bem_estar" },
    { text: "Meu trabalho tem afetado negativamente minha saúde física ou emocional.", type: L, dimension: "bem_estar", reverse: true },
    { text: "Tenho sentido ansiedade, estresse ou esgotamento relacionados ao trabalho.", type: L, dimension: "bem_estar", reverse: true },
  ],
};
const blocoSobrecarga: Block = {
  section: "Sobrecarga e Pressão",
  questions: [
    { text: "Minha carga de trabalho é compatível com meu horário.", type: L, dimension: "sobrecarga" },
    { text: "Consigo concluir minhas atividades sem levar trabalho para casa.", type: L, dimension: "sobrecarga" },
    { text: "Recebo demandas urgentes em excesso.", type: L, dimension: "sobrecarga", reverse: true },
    { text: "As metas e prazos são realistas.", type: L, dimension: "sobrecarga" },
    { text: "Sinto pressão excessiva por resultados.", type: L, dimension: "sobrecarga", reverse: true },
  ],
};
const blocoSeguranca: Block = {
  section: "Segurança Psicológica",
  questions: [
    { text: "Posso expressar minha opinião sem medo de represálias.", type: L, dimension: "seguranca" },
    { text: "Posso discordar da liderança de forma respeitosa.", type: L, dimension: "seguranca" },
    { text: "Posso admitir erros sem ser humilhado ou exposto.", type: L, dimension: "seguranca" },
    { text: "Sinto que sou ouvido pela empresa.", type: L, dimension: "seguranca" },
    { text: "Posso pedir ajuda quando necessário.", type: L, dimension: "seguranca" },
  ],
};
const blocoLideranca: Block = {
  section: "Liderança Saudável",
  questions: [
    { text: "Meu líder me trata com respeito.", type: L, dimension: "lideranca" },
    { text: "Meu líder dá feedback de forma construtiva.", type: L, dimension: "lideranca" },
    { text: "Meu líder reconhece bons resultados.", type: L, dimension: "lideranca" },
    { text: "Meu líder escuta a equipe.", type: L, dimension: "lideranca" },
    { text: "Meu líder demonstra equilíbrio emocional.", type: L, dimension: "lideranca" },
    { text: "Meu líder distribui demandas de forma justa.", type: L, dimension: "lideranca" },
  ],
};
const blocoConduta: Block = {
  section: "Ambiente, Relacionamento e Conduta",
  questions: [
    { text: "O ambiente de trabalho é respeitoso.", type: L, dimension: "conduta" },
    { text: "Existe cooperação entre os colegas.", type: L, dimension: "conduta" },
    { text: "Sinto que existe respeito entre as pessoas.", type: L, dimension: "conduta" },
    { text: "Já presenciei humilhações, gritos ou exposição pública.", type: "YES_NO" as QuestionType, sensitive: true },
    { text: "Já presenciei discriminação, perseguição ou assédio.", type: "YES_NO" as QuestionType, sensitive: true },
    { text: "Caso tenha presenciado/sofrido, indique a situação:", type: M, sensitive: true, required: false, options: ["Humilhação", "Gritos", "Exposição pública", "Ameaças", "Discriminação", "Assédio moral", "Assédio sexual", "Perseguição", "Nenhuma das opções", "Prefiro não responder"] },
  ],
};
const blocoEngajamento: Block = {
  section: "Reconhecimento, Propósito e Engajamento",
  questions: [
    { text: "Sinto que meu trabalho é valorizado.", type: L, dimension: "engajamento" },
    { text: "Entendo a importância do meu papel na empresa.", type: L, dimension: "engajamento" },
    { text: "Tenho orgulho de trabalhar aqui.", type: L, dimension: "engajamento" },
    { text: "Vejo oportunidades de crescimento.", type: L, dimension: "engajamento" },
    { text: "Sinto vontade de continuar na empresa.", type: L, dimension: "engajamento" },
  ],
};
const blocoEnps: Block = {
  section: "eNPS Interno",
  questions: [
    { text: "Em uma escala de 0 a 10, quanto você recomendaria esta empresa como um bom lugar para trabalhar?", type: S10, dimension: "enps" },
  ],
};
const blocoAbertas: Block = {
  section: "Perguntas Abertas",
  questions: [
    { text: "O que mais gera estresse ou desgaste no seu trabalho?", type: T, required: false },
    { text: "O que a empresa poderia fazer para melhorar seu bem-estar?", type: T, required: false },
    { text: "Existe alguma situação que você gostaria de relatar de forma confidencial?", type: T, required: false, sensitive: true },
    { text: "Que sugestão você daria para melhorar o ambiente da empresa?", type: T, required: false },
  ],
};

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    key: "diagnostico_completo",
    title: "Diagnóstico de Clima, Saúde Mental e Riscos Psicossociais",
    description: "Modelo completo (10 blocos): pulso emocional, bem-estar, sobrecarga, segurança psicológica, liderança, conduta, engajamento, eNPS e perguntas abertas.",
    type: "PSYCHOSOCIAL" as SurveyType,
    blocks: [blocoPerfil, blocoPulso, blocoBemEstar, blocoSobrecarga, blocoSeguranca, blocoLideranca, blocoConduta, blocoEngajamento, blocoEnps, blocoAbertas],
  },
  {
    key: "clima",
    title: "Pesquisa de Clima Organizacional",
    description: "Clima geral: ambiente, engajamento, liderança e eNPS.",
    type: "CLIMATE" as SurveyType,
    blocks: [blocoPulso, blocoConduta, blocoEngajamento, blocoLideranca, blocoEnps, blocoAbertas],
  },
  {
    key: "saude_mental",
    title: "Pesquisa de Saúde Mental",
    description: "Bem-estar emocional, sobrecarga e pulso emocional.",
    type: "EMOTIONAL_HEALTH" as SurveyType,
    blocks: [blocoPulso, blocoBemEstar, blocoSobrecarga, blocoAbertas],
  },
  {
    key: "lideranca",
    title: "Avaliação de Liderança",
    description: "Percepção sobre a liderança direta.",
    type: "LEADERSHIP_EVAL" as SurveyType,
    blocks: [blocoLideranca, blocoSeguranca, blocoAbertas],
  },
  {
    key: "engajamento",
    title: "Pesquisa de Engajamento",
    description: "Reconhecimento, propósito, engajamento e eNPS.",
    type: "CLIMATE" as SurveyType,
    blocks: [blocoEngajamento, blocoEnps, blocoAbertas],
  },
  {
    key: "seguranca",
    title: "Pesquisa de Segurança Psicológica",
    description: "Abertura para opinar, errar e pedir ajuda sem represálias.",
    type: "PSYCHOSOCIAL" as SurveyType,
    blocks: [blocoSeguranca, blocoConduta, blocoAbertas],
  },
  {
    key: "pulso_semanal",
    title: "Pesquisa Pulso Semanal",
    description: "Check-in rápido do estado emocional da equipe.",
    type: "PULSE" as SurveyType,
    blocks: [blocoPulso, { section: "Pulso", questions: [{ text: "Minha carga desta semana foi sustentável.", type: L, dimension: "sobrecarga" }, { text: "Me senti apoiado pela liderança nesta semana.", type: L, dimension: "lideranca" }] }],
  },
];

export function getTemplate(key: string): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES.find((t) => t.key === key);
}

/** Achata os blocos do modelo em perguntas (com seção preenchida). */
export function templateQuestions(t: SurveyTemplate): QuestionInput[] {
  const out: QuestionInput[] = [];
  for (const block of t.blocks) {
    for (const q of block.questions) {
      out.push({
        text: q.text,
        type: q.type,
        required: q.required ?? true,
        options: q.options,
        section: block.section,
        dimension: q.dimension,
        reverseScored: q.reverse ?? false,
        sensitive: q.sensitive ?? false,
      });
    }
  }
  return out;
}

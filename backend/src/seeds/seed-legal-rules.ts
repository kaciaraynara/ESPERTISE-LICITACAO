/**
 * Seed: Regras Jurídicas da Lei 14.133/2021 (Nova Lei de Licitações)
 *
 * Este script insere na tabela `legal_rules` os artigos mais relevantes
 * para detecção de nulidades, irregularidades e análise de conformidade
 * em editais de licitação pública.
 *
 * Fonte oficial: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm
 */

import { prisma } from '../database/prisma';

interface LegalRuleSeed {
  code: string;
  name: string;
  description: string;
  severity: string;
  category: string;
  legalBasis: { lei: string; artigo: string; inciso?: string; paragrafo?: string; url: string };
  criteria: { patterns: string[]; context: string };
  alertMessage: string;
  recommendation: string;
}

const RULES_LEI_14133: LegalRuleSeed[] = [
  // ─── MODALIDADES E LIMITES (Art. 28-32) ──────────────────────────────────
  {
    code: 'NLL-001',
    name: 'Fracionamento indevido para fuga de modalidade',
    description:
      'Detecta quando o valor estimado do objeto aparenta ter sido fracionado indevidamente para evitar a modalidade de licitação exigida pela lei.',
    severity: 'critical',
    category: 'modalidade',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 28',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art28',
    },
    criteria: {
      patterns: ['fracionamento', 'divisão de objeto', 'lote separado injustificado'],
      context:
        'Se o valor total dos lotes somados exige Concorrência ou Pregão, mas o edital fracionou em dispensas ou cotações, há vício.',
    },
    alertMessage:
      'O edital apresenta indícios de fracionamento do objeto para fuga da modalidade obrigatória.',
    recommendation:
      'Verificar se a soma dos lotes extrapola o limite da modalidade escolhida (Art. 28 da Lei 14.133/2021). Considerar impugnação administrativa.',
  },
  {
    code: 'NLL-002',
    name: 'Adoção de modalidade inadequada ao objeto',
    description:
      'Verifica se a modalidade licitatória utilizada é compatível com a natureza do objeto contratado.',
    severity: 'high',
    category: 'modalidade',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 29',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art29',
    },
    criteria: {
      patterns: ['pregão para obra', 'concorrência para bens comuns', 'modalidade incompatível'],
      context:
        'Pregão se destina a bens e serviços comuns. Usar Pregão para obras de engenharia complexas é ilegal.',
    },
    alertMessage:
      'A modalidade de licitação adotada não é compatível com a natureza do objeto.',
    recommendation:
      'Consultar Art. 29 da Lei 14.133/2021 para verificar a modalidade correta e avaliar impugnação.',
  },

  // ─── EDITAL E CLÁUSULAS RESTRITIVAS (Art. 9, 14, 18-26) ──────────────────
  {
    code: 'NLL-003',
    name: 'Exigência de marca ou produto específico sem justificativa',
    description:
      'Detecta quando o edital exige marca ou produto específico sem justificativa técnica fundamentada.',
    severity: 'critical',
    category: 'edital',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 41',
      inciso: 'I',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art41',
    },
    criteria: {
      patterns: [
        'marca',
        'modelo específico',
        'apenas',
        'exclusivamente',
        'tipo único',
        'referência exclusiva',
      ],
      context:
        'É vedada a indicação de marca, exceto quando tecnicamente justificada ou para padronização.',
    },
    alertMessage:
      'O edital indica marca ou produto específico sem justificativa técnica adequada.',
    recommendation:
      'Impugnar com base no Art. 41, I, da Lei 14.133/2021. A indicação de marca sem justificativa é nula.',
  },
  {
    code: 'NLL-004',
    name: 'Exigência de habilitação excessiva ou desproporcional',
    description:
      'Identifica exigências de qualificação técnica ou econômica desproporcionais ao objeto.',
    severity: 'high',
    category: 'habilitacao',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 67',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art67',
    },
    criteria: {
      patterns: [
        'capital social mínimo acima de 10%',
        'atestado com quantidade superior',
        'exigência de ISS local',
        'tempo mínimo de funcionamento',
        'número mínimo de funcionários',
      ],
      context:
        'As exigências de habilitação devem ser proporcionais ao objeto e não podem restringir a competitividade.',
    },
    alertMessage:
      'O edital contém exigências de habilitação desproporcionais ao objeto licitado.',
    recommendation:
      'Verificar Art. 67 a 70 da Lei 14.133/2021. Capital social acima de 10% do valor estimado é abusivo.',
  },
  {
    code: 'NLL-005',
    name: 'Ausência de orçamento estimado',
    description:
      'Verifica se o edital contém o orçamento estimado da contratação, salvo exceções previstas.',
    severity: 'critical',
    category: 'edital',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 24',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art24',
    },
    criteria: {
      patterns: ['valor não informado', 'orçamento sigiloso sem justificativa', 'sem valor estimado'],
      context:
        'O orçamento deve constar no edital ou em anexo. Se sigiloso, deve haver justificativa expressa.',
    },
    alertMessage:
      'O edital não apresenta orçamento estimado e não justifica o sigilo orçamentário.',
    recommendation:
      'Art. 24 exige publicação do orçamento. O sigilo deve ser motivado expressamente.',
  },

  // ─── CRITÉRIOS DE JULGAMENTO (Art. 33-39) ─────────────────────────────────
  {
    code: 'NLL-006',
    name: 'Critério de julgamento incompatível com o objeto',
    description:
      'Verifica se o critério de julgamento (menor preço, melhor técnica, etc.) é adequado ao objeto.',
    severity: 'high',
    category: 'julgamento',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 33',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art33',
    },
    criteria: {
      patterns: [
        'menor preço para serviço de engenharia complexo',
        'técnica e preço para bens comuns',
      ],
      context:
        'Bens comuns devem ser julgados por menor preço. Serviços técnicos especializados admitem técnica e preço.',
    },
    alertMessage:
      'O critério de julgamento adotado pode ser incompatível com a natureza do objeto.',
    recommendation:
      'Consultar Art. 33 e incisos para verificar a adequação do critério de julgamento.',
  },
  {
    code: 'NLL-007',
    name: 'Ausência de critérios objetivos de desempate',
    description:
      'Verifica se o edital prevê critérios de desempate conforme a Lei.',
    severity: 'medium',
    category: 'julgamento',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 60',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art60',
    },
    criteria: {
      patterns: ['desempate', 'critérios de desempate', 'ME/EPP preferência'],
      context:
        'A lei exige que o edital preveja os critérios de desempate, inclusive a preferência para ME/EPP.',
    },
    alertMessage:
      'O edital não prevê critérios de desempate ou ignora a preferência legal para ME/EPP.',
    recommendation:
      'Art. 60 da Lei 14.133/2021 elenca critérios objetivos de desempate obrigatórios.',
  },

  // ─── ME/EPP - LC 123/2006 ─────────────────────────────────────────────────
  {
    code: 'NLL-008',
    name: 'Ausência do tratamento diferenciado para ME/EPP',
    description:
      'Verifica se o edital observa o tratamento diferenciado obrigatório para Microempresas e Empresas de Pequeno Porte.',
    severity: 'critical',
    category: 'me_epp',
    legalBasis: {
      lei: 'LC 123/2006',
      artigo: 'Art. 48',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm#art48',
    },
    criteria: {
      patterns: [
        'sem reserva para ME',
        'sem subcontratação ME',
        'sem cota de 25%',
        'não observa LC 123',
      ],
      context:
        'Para licitações de até R$ 80.000,00, a participação deve ser exclusiva de ME/EPP. Acima, deve haver cota de até 25%.',
    },
    alertMessage:
      'O edital não observa o tratamento diferenciado para Microempresas e Empresas de Pequeno Porte.',
    recommendation:
      'Impugnar com base na LC 123/2006, Art. 47 e 48. O tratamento diferenciado é obrigatório.',
  },
  {
    code: 'NLL-009',
    name: 'Margem de preferência ME/EPP ignorada',
    description:
      'Verifica se o edital aplica a margem de preferência de até 5% para ME/EPP na fase de lance.',
    severity: 'high',
    category: 'me_epp',
    legalBasis: {
      lei: 'LC 123/2006',
      artigo: 'Art. 44',
      paragrafo: '§1º e §2º',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm#art44',
    },
    criteria: {
      patterns: ['empate ficto', 'margem preferência ME', '5%'],
      context:
        'Propostas de ME/EPP até 5% superiores ao menor preço são consideradas empatadas para fins de desempate.',
    },
    alertMessage:
      'O edital não prevê a margem de preferência (empate ficto) de 5% para ME/EPP.',
    recommendation:
      'Art. 44 §1º e §2º da LC 123/2006. A margem de 5% é direito legal das ME/EPP.',
  },

  // ─── PRAZOS E PUBLICIDADE (Art. 53-55) ────────────────────────────────────
  {
    code: 'NLL-010',
    name: 'Prazo de publicidade insuficiente',
    description:
      'Verifica se o prazo entre a publicação do edital e a abertura das propostas atende ao mínimo legal.',
    severity: 'critical',
    category: 'publicidade',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 55',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art55',
    },
    criteria: {
      patterns: ['prazo mínimo', 'dias úteis', 'publicação', 'abertura de propostas'],
      context:
        'Pregão: 8 dias úteis. Concorrência menor preço: 15 dias úteis. Concorrência técnica: 35 dias úteis.',
    },
    alertMessage:
      'O prazo entre publicação e abertura do certame pode ser inferior ao mínimo legal.',
    recommendation:
      'Verificar os prazos do Art. 55 e considerar impugnação se o prazo for insuficiente.',
  },

  // ─── VEDAÇÕES (Art. 9) ─────────────────────────────────────────────────────
  {
    code: 'NLL-011',
    name: 'Conflito de interesses ou impedimento',
    description:
      'Detecta indícios de que o autor do projeto básico ou executivo está participando da licitação.',
    severity: 'critical',
    category: 'impedimento',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 9',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art9',
    },
    criteria: {
      patterns: [
        'autor do projeto participando',
        'conflito de interesse',
        'parentesco',
        'empresa do servidor',
      ],
      context:
        'É vedada a participação de pessoa que elaborou o projeto, seus familiares e empresas vinculadas.',
    },
    alertMessage:
      'Há possível conflito de interesses ou impedimento na participação de licitante.',
    recommendation:
      'Art. 9 da Lei 14.133/2021 lista os impedidos. Coletar provas e impugnar ou representar ao TCU.',
  },

  // ─── PESQUISA DE PREÇOS (Art. 23) ──────────────────────────────────────────
  {
    code: 'NLL-012',
    name: 'Pesquisa de preços insuficiente ou unilateral',
    description:
      'Verifica se o edital evidencia pesquisa de preços adequada com fontes diversificadas.',
    severity: 'high',
    category: 'preco',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 23',
      paragrafo: '§1º',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art23',
    },
    criteria: {
      patterns: [
        'pesquisa de preços com uma fonte',
        'preço de tabela',
        'sem cotação',
        'preço único',
      ],
      context:
        'A pesquisa de preços deve utilizar no mínimo 3 fontes distintas (painel PNCP, atas, contratos, cotações).',
    },
    alertMessage:
      'A pesquisa de preços do edital pode ser insuficiente ou baseada em fonte única.',
    recommendation:
      'Art. 23 §1º exige pesquisa diversificada. Considerar pedido de esclarecimento ou impugnação.',
  },

  // ─── CONTRATO E GARANTIA (Art. 96-100) ────────────────────────────────────
  {
    code: 'NLL-013',
    name: 'Exigência de garantia acima do limite legal',
    description:
      'Verifica se a exigência de garantia contratual excede o limite de 5% (ou 10% para alta complexidade).',
    severity: 'high',
    category: 'contrato',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 98',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art98',
    },
    criteria: {
      patterns: ['garantia acima de 5%', 'garantia contratual 10%', 'caução excessiva'],
      context:
        'A garantia contratual é limitada a 5% do valor do contrato. Para obras e serviços de alta complexidade, até 10%.',
    },
    alertMessage:
      'A garantia exigida pode exceder o limite legal de 5% (ou 10% para alta complexidade).',
    recommendation:
      'Verificar Art. 98 da Lei 14.133/2021 e impugnar se a garantia for excessiva.',
  },

  // ─── SUSTENTABILIDADE (Art. 11, IV) ────────────────────────────────────────
  {
    code: 'NLL-014',
    name: 'Ausência de critérios de sustentabilidade',
    description:
      'Verifica se o edital observa os critérios de sustentabilidade previstos na lei.',
    severity: 'low',
    category: 'sustentabilidade',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 11',
      inciso: 'IV',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art11',
    },
    criteria: {
      patterns: ['sem critério ambiental', 'sem sustentabilidade'],
      context:
        'A lei determina que as licitações devem observar critérios de sustentabilidade ambiental.',
    },
    alertMessage:
      'O edital pode não observar critérios de sustentabilidade ambiental obrigatórios.',
    recommendation:
      'Art. 11, IV obriga observância de critérios sustentáveis. Avaliar se cabe pedido de esclarecimento.',
  },

  // ─── IMPUGNAÇÃO (Art. 164) ─────────────────────────────────────────────────
  {
    code: 'NLL-015',
    name: 'Prazo de impugnação não respeitado',
    description:
      'Verifica se o edital respeita o prazo mínimo para impugnação do edital.',
    severity: 'critical',
    category: 'impugnacao',
    legalBasis: {
      lei: 'Lei 14.133/2021',
      artigo: 'Art. 164',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art164',
    },
    criteria: {
      patterns: ['impugnação', 'prazo para questionar', '3 dias úteis'],
      context:
        'Qualquer pessoa pode impugnar o edital até 3 dias úteis antes da data de abertura.',
    },
    alertMessage:
      'Atenção ao prazo de impugnação: até 3 dias úteis antes da abertura do certame.',
    recommendation:
      'Art. 164 garante 3 dias úteis para impugnar. Preparar a peça com antecedência.',
  },
];

async function seedLegalRules() {
  console.log('🔄 Iniciando seed de regras jurídicas (Lei 14.133/2021 e LC 123/2006)...');

  let created = 0;
  let skipped = 0;

  for (const rule of RULES_LEI_14133) {
    const existing = await prisma.legalRule.findFirst({
      where: { code: rule.code, version: '1.0.0', tenantId: null },
    });

    if (existing) {
      console.log(`  ⏭  ${rule.code} — ${rule.name} (já existe)`);
      skipped++;
      continue;
    }

    await prisma.legalRule.create({
      data: {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        category: rule.category,
        legalBasis: rule.legalBasis,
        version: '1.0.0',
        active: true,
        workflowStatus: 'active',
        criteria: rule.criteria,
        alertMessage: rule.alertMessage,
        recommendation: rule.recommendation,
        metadata: {
          source: 'seed',
          seedVersion: '2026-07-30',
          autoGenerated: true,
        },
      },
    });

    console.log(`  ✅ ${rule.code} — ${rule.name}`);
    created++;
  }

  console.log(`\n📊 Resultado: ${created} regras criadas, ${skipped} já existentes.`);
  console.log('✅ Seed de regras jurídicas concluído com sucesso!\n');
}

seedLegalRules()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Seed: Motor de Regras Tributárias Versionado (Expertise Fiscal)
 *
 * Popula a tabela `tax_rule_versions` com as regras tributárias reais vigentes
 * aplicáveis a compras governamentais, retenções na fonte, incentivos legais
 * e a transição da Reforma Tributária (EC 132/2023 e LC 214/2025).
 *
 * PRINCÍPIO: ZERO alíquotas fixas hardcoded na aplicação.
 */

import { prisma } from '../database/prisma';

export interface TaxRuleSeedItem {
  ruleCode: string;
  taxName: string;
  taxRegime: string;
  operationType: string;
  cnaePrefix?: string;
  ncmCode?: string;
  ratePercent: number;
  reducerPercent?: number;
  allowsCredit: boolean;
  creditRulesJson: Record<string, any>;
  legalBasis: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  versionNumber: number;
  changelog: string;
}

export const TAX_RULES_CATALOG: TaxRuleSeedItem[] = [
  // ─── 1. TABELA DE RETENÇÕES DA IN RFB Nº 1.234/2012 (ALTERADA PELA IN 2.145/2023) ───
  {
    ruleCode: 'IN1234_BENS_TOTAL',
    taxName: 'IRRF_CSLL_PIS_COFINS',
    taxRegime: 'LUCRO_PRESUMIDO',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 5.85,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      discriminacao: { irrf: 1.20, csll: 1.00, pis: 0.65, cofins: 3.00, total: 5.85 },
      codigoReceita: '6147',
      permiteDeducaoApuracao: true,
      naturezaRendimento: 'Fornecimento de mercadorias ou bens em geral para órgãos públicos',
    },
    legalBasis: 'IN RFB nº 1.234/2012, Art. 2º e Anexo I, Código 6147 (alterada pela IN RFB nº 2.145/2023)',
    effectiveFrom: new Date('2023-06-27T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Extensão das retenções federais para órgãos estaduais e municipais conforme Tese do Tema 1130 do STF.',
  },
  {
    ruleCode: 'IN1234_SERVICOS_TOTAL',
    taxName: 'IRRF_CSLL_PIS_COFINS',
    taxRegime: 'LUCRO_PRESUMIDO',
    operationType: 'SERVICOS_CONTINUOS',
    ratePercent: 9.45,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      discriminacao: { irrf: 4.80, csll: 1.00, pis: 0.65, cofins: 3.00, total: 9.45 },
      codigoReceita: '6190',
      permiteDeducaoApuracao: true,
      naturezaRendimento: 'Prestação de serviços em geral com emprego de mão de obra ou intelectual',
    },
    legalBasis: 'IN RFB nº 1.234/2012, Art. 2º e Anexo I, Código 6190 (alterada pela IN RFB nº 2.145/2023)',
    effectiveFrom: new Date('2023-06-27T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Retenção na fonte aplicável aos pagamentos de serviços efetuados por órgãos e entidades públicas.',
  },
  {
    ruleCode: 'IN1234_CONSTRUCAO_MATERIAIS',
    taxName: 'IRRF',
    taxRegime: 'ALL',
    operationType: 'ENGENHARIA_OBRAS',
    ratePercent: 1.20,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      discriminacao: { irrf: 1.20, csll: 1.00, pis: 0.65, cofins: 3.00, total: 5.85 },
      condicao: 'Obras de construção civil com fornecimento de materiais comprovados em planilha de medição',
      permiteDeducaoApuracao: true,
    },
    legalBasis: 'IN RFB nº 1.234/2012, Art. 2º, § 7º e Anexo I',
    effectiveFrom: new Date('2012-01-12T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Aplicação da alíquota reduzida de IR (1,20%) para obras de engenharia com fornecimento próprio de materiais.',
  },
  {
    ruleCode: 'IN1234_SIMPLES_ISENCAO',
    taxName: 'IRRF',
    taxRegime: 'SIMPLES_NACIONAL',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 0.00,
    reducerPercent: 100.00,
    allowsCredit: false,
    creditRulesJson: {
      dispensaRetencaoTotal: true,
      tributosDispensados: ['IRRF', 'CSLL', 'PIS', 'COFINS'],
      declaracaoExigida: 'Declaração de Opção pelo Simples Nacional nos termos do Anexo IV da IN RFB 1.234/2012',
    },
    legalBasis: 'IN RFB nº 1.234/2012, Art. 4º, Inciso XI e Lei Complementar nº 123/2006, Art. 13, § 1º',
    effectiveFrom: new Date('2012-01-12T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Isenção obrigatória de retenções federais para Microempresas (ME) e EPP optantes pelo Simples Nacional.',
  },

  // ─── 2. RETENÇÃO PREVIDENCIÁRIA DO INSS (ART. 31 LEI 8.212/91 E IN 2.110/2022) ───
  {
    ruleCode: 'INSS_CESSAO_MAO_OBRA_11',
    taxName: 'INSS',
    taxRegime: 'ALL',
    operationType: 'SERVICOS_CONTINUOS',
    ratePercent: 11.00,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      baseCalculo: 'Valor bruto da nota fiscal, fatura ou recibo de prestação de serviços',
      permiteDeducaoMaterialEquipamentos: true,
      compensacaoDctfWeb: true,
      compensavelComContribuicoesPrevidenciarias: true,
    },
    legalBasis: 'Lei nº 8.212/1991, Art. 31 e IN RFB nº 2.110/2022, Arts. 110 a 112',
    effectiveFrom: new Date('2022-10-17T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Retenção previdenciária de 11% pelo tomador de serviço mediante cessão de mão de obra ou empreitada.',
  },
  {
    ruleCode: 'INSS_CPRB_DESONERACAO_35',
    taxName: 'INSS',
    taxRegime: 'ALL',
    operationType: 'SERVICOS_CONTINUOS',
    ratePercent: 3.50,
    reducerPercent: 68.18,
    allowsCredit: true,
    creditRulesJson: {
      regime: 'Desoneração da Folha de Pagamentos (CPRB)',
      aliquotaEspecial: 3.50,
      compensacaoDctfWeb: true,
      exigencia: 'Declaração formal da empresa de enquadramento na Lei 12.546/2011',
    },
    legalBasis: 'Lei nº 12.546/2011, Art. 7º, § 6º e IN RFB nº 2.110/2022, Art. 122',
    effectiveFrom: new Date('2022-10-17T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Alíquota diferenciada de 3,5% na retenção do INSS para setores desonerados sob o regime da CPRB.',
  },

  // ─── 3. CRÉDITOS PIS/COFINS MONOFÁSICO & ICMS-ST ───
  {
    ruleCode: 'PIS_COFINS_MONOFASICO_RESSARCIMENTO',
    taxName: 'PIS_COFINS',
    taxRegime: 'SIMPLES_NACIONAL',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 0.00,
    reducerPercent: 100.00,
    allowsCredit: true,
    creditRulesJson: {
      recuperacaoRetroativaAnos: 5,
      mecanismo: 'Segregação de receita decorrente da venda de produtos monofásicos no PGDAS-D',
      gruposProdutos: ['Medicamentos', 'Produtos de Perfumaria e Toucador', 'Autopeças', 'Bebidas Frias', 'Combustíveis'],
    },
    legalBasis: 'Lei nº 10.147/2000, Lei nº 10.485/2002 e LC nº 123/2006, Art. 18, § 4º-A, Inciso I',
    effectiveFrom: new Date('2009-01-01T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Crédito financeiro decorrente de não-segregação de receitas com tributação monofásica anterior.',
  },

  // ─── 4. REFORMA TRIBUTÁRIA: ANO DE TESTE 2026 (EC 132/2023 & LC 214/2025) ───
  {
    ruleCode: 'REFORMA_TESTE_2026_CBS',
    taxName: 'CBS',
    taxRegime: 'ALL',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 0.90,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      anoVigencia: 2026,
      compensavelCom: ['PIS', 'COFINS'],
      naoCumulatividadePlena: true,
      mecanismoCompensacao: 'Compensação direta no valor devido de PIS/COFINS apurado no período',
    },
    legalBasis: 'Emenda Constitucional nº 132/2023, Art. 127 e LC nº 214/2025, Art. 12',
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: new Date('2026-12-31T23:59:59Z'),
    versionNumber: 1,
    changelog: 'Alíquota de teste da Contribuição sobre Bens e Serviços (CBS) de 0,9% no período de transição 2026.',
  },
  {
    ruleCode: 'REFORMA_TESTE_2026_IBS',
    taxName: 'IBS',
    taxRegime: 'ALL',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 0.10,
    reducerPercent: 0,
    allowsCredit: true,
    creditRulesJson: {
      anoVigencia: 2026,
      compensavelCom: ['PIS', 'COFINS'],
      naoCumulatividadePlena: true,
      arrecadacaoCentralizada: true,
    },
    legalBasis: 'Emenda Constitucional nº 132/2023, Art. 127 e LC nº 214/2025, Art. 12',
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: new Date('2026-12-31T23:59:59Z'),
    versionNumber: 1,
    changelog: 'Alíquota de teste do Imposto sobre Bens e Serviços (IBS) de 0,1% no período de transição 2026.',
  },

  // ─── 5. REFORMA TRIBUTÁRIA: REGIMES DIFERENCIADOS COM REDUTORES (EC 132/2023) ───
  {
    ruleCode: 'REFORMA_IVA_DUAL_SAUDE_EDUCACAO_60',
    taxName: 'CBS_IBS',
    taxRegime: 'ALL',
    operationType: 'SAUDE_EDUCACAO',
    ratePercent: 10.60,
    reducerPercent: 60.00,
    allowsCredit: true,
    creditRulesJson: {
      aliquotaReferenciaPadrao: 26.50,
      fatorReducao: 0.60,
      aliquotaEfetivaCalculada: 10.60,
      setoresBeneficiados: ['Serviços de Saúde', 'Serviços de Educação', 'Dispositivos Médicos e de Acessibilidade', 'Insumos Agropecuários'],
    },
    legalBasis: 'Emenda Constitucional nº 132/2023, Art. 9º, § 1º e LC nº 214/2025',
    effectiveFrom: new Date('2027-01-01T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Regime diferenciado com redução de 60% da alíquota padrão do IVA Dual para saúde, educação e agro.',
  },
  {
    ruleCode: 'REFORMA_IVA_DUAL_PROF_REGULAMENTADA_30',
    taxName: 'CBS_IBS',
    taxRegime: 'ALL',
    operationType: 'SERVICOS_CONTINUOS',
    ratePercent: 18.55,
    reducerPercent: 30.00,
    allowsCredit: true,
    creditRulesJson: {
      aliquotaReferenciaPadrao: 26.50,
      fatorReducao: 0.30,
      aliquotaEfetivaCalculada: 18.55,
      requisito: 'Prestação de serviços por profissionais liberais sob fiscalização de conselho de classe regulamentado',
    },
    legalBasis: 'Emenda Constitucional nº 132/2023, Art. 9º, § 5º e LC nº 214/2025',
    effectiveFrom: new Date('2027-01-01T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Regime favorecido com redução de 30% da alíquota padrão para profissões regulamentadas (OAB, CREA, CRC, CAU, etc.).',
  },
  {
    ruleCode: 'REFORMA_IVA_DUAL_PADRAO',
    taxName: 'CBS_IBS',
    taxRegime: 'LUCRO_REAL',
    operationType: 'FORNECIMENTO_BENS',
    ratePercent: 26.50,
    reducerPercent: 0.00,
    allowsCredit: true,
    creditRulesJson: {
      cbsEstimada: 8.80,
      ibsEstimado: 17.70,
      totalReferencia: 26.50,
      principioDestino: true,
      creditamentoAmplo: 'Direito a crédito financeiro sobre todas as aquisições de bens e serviços tributados',
    },
    legalBasis: 'Emenda Constitucional nº 132/2023 e LC nº 214/2025 (PLP 68/2024)',
    effectiveFrom: new Date('2027-01-01T00:00:00Z'),
    versionNumber: 1,
    changelog: 'Alíquota de referência padrão estimada para fornecimento de bens e serviços com tributação no destino.',
  },
];

export async function seedTaxRules() {
  console.log('\n⚖️  Iniciando Seed do Motor de Regras Tributárias (Expertise Fiscal)...');

  let criadas = 0;
  let atualizadas = 0;

  for (const item of TAX_RULES_CATALOG) {
    const existing = await prisma.taxRuleVersion.findFirst({
      where: {
        ruleCode: item.ruleCode,
        versionNumber: item.versionNumber,
      },
    });

    if (existing) {
      await prisma.taxRuleVersion.update({
        where: { id: existing.id },
        data: {
          taxName: item.taxName,
          taxRegime: item.taxRegime,
          operationType: item.operationType,
          cnaePrefix: item.cnaePrefix,
          ncmCode: item.ncmCode,
          ratePercent: item.ratePercent,
          reducerPercent: item.reducerPercent ?? 0,
          allowsCredit: item.allowsCredit,
          creditRulesJson: item.creditRulesJson,
          legalBasis: item.legalBasis,
          effectiveFrom: item.effectiveFrom,
          effectiveTo: item.effectiveTo,
          changelog: item.changelog,
        },
      });
      atualizadas++;
      console.log(`  🔄 Atualizada: ${item.ruleCode} (${item.ratePercent}%) — ${item.legalBasis.slice(0, 45)}...`);
    } else {
      await prisma.taxRuleVersion.create({
        data: {
          ruleCode: item.ruleCode,
          taxName: item.taxName,
          taxRegime: item.taxRegime,
          operationType: item.operationType,
          cnaePrefix: item.cnaePrefix,
          ncmCode: item.ncmCode,
          ratePercent: item.ratePercent,
          reducerPercent: item.reducerPercent ?? 0,
          allowsCredit: item.allowsCredit,
          creditRulesJson: item.creditRulesJson,
          legalBasis: item.legalBasis,
          effectiveFrom: item.effectiveFrom,
          effectiveTo: item.effectiveTo,
          versionNumber: item.versionNumber,
          changelog: item.changelog,
        },
      });
      criadas++;
      console.log(`  ✅ Criada: ${item.ruleCode} (${item.ratePercent}%) — ${item.legalBasis.slice(0, 45)}...`);
    }
  }

  console.log(`\n📊 Concluído: ${criadas} regras tributárias criadas, ${atualizadas} atualizadas.`);
  console.log('✅ Motor de Regras Tributárias populado com sucesso!\n');
}

// Execução direta quando invocado via CLI
if (require.main === module) {
  seedTaxRules()
    .catch((err) => {
      console.error('❌ Falha ao executar seed de regras tributárias:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

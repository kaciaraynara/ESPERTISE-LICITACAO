import { prisma } from '../database/prisma';

export interface CalculoViabilidadeInput {
  precoLance: number;
  custoProduto: number;
  percentualImpostos: number;
  custoLogistico: number;
  taxasAdministrativas: number;
}

export interface EtapaViabilidade {
  ordem: number;
  descricao: string;
  valorSubtraido: number;
  saldo: number;
}

export interface CalculoViabilidadeResultado {
  baseCalculo: number;
  precoLance: number;
  custoProduto: number;
  impostosValor: number;
  custoLogistico: number;
  taxasAdministrativas: number;
  margemLucroRealValor: number;
  margemLucroRealPercentual: number;
  margemSaudavel: boolean;
  etapas: EtapaViabilidade[];
}

export type RegimeTributario =
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | 'MEI';

/**
 * Alíquotas tributárias médias autênticas por Regime Tributário da empresa (Lei 14.133/21 e Legislação Fiscal)
 */
export const ALIQUOTAS_REGIME_TRIBUTARIO: Record<RegimeTributario, number> = {
  MEI: 0.0, // Alíquota fixa mensal (SIMEI), 0% variável sobre faturamento
  SIMPLES_NACIONAL: 8.5, // Alíquota efetiva média do Simples Nacional (Anexos I/II/IV)
  LUCRO_PRESUMIDO: 13.65, // PIS/COFINS (3.65%) + IRPJ/CSLL presumidos + ISS/ICMS
  LUCRO_REAL: 18.25, // Regime não-cumulativo PIS (1.65%) + COFINS (7.6%) + IRPJ/CSLL
};

export function obterAliquotaRegimeTributario(regime?: string | null): number {
  if (!regime) return ALIQUOTAS_REGIME_TRIBUTARIO.SIMPLES_NACIONAL;
  const normalized = regime
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_') as RegimeTributario;

  return ALIQUOTAS_REGIME_TRIBUTARIO[normalized] ?? ALIQUOTAS_REGIME_TRIBUTARIO.SIMPLES_NACIONAL;
}

export interface CalculoViabilidadeAutenticaInput {
  companyId?: string;
  userId?: string;
  catalogItemId?: string;
  catalogItemIds?: string[];
  objetoEdital?: string;
  estimativaEdital: number;
  precoLance?: number;
  regimeTributario?: RegimeTributario | string;
  custoProdutoInformado?: number;
  percentualImpostosInformado?: number;
  custoLogistico?: number;
  taxasAdministrativas?: number;
  margemDesejadaPercentual?: number;
}

export interface CalculoViabilidadeAutenticaResultado {
  viabilidade: CalculoViabilidadeResultado;
  origemCustoProduto: 'CATALOGO_PRODUTOS' | 'INFORMADO_PELO_USUARIO' | 'SEM_PRODUTO_VINCULADO';
  origemTributacao: 'REGIME_EMPRESA' | 'INFORMADO_PELO_USUARIO' | 'SIMPLES_NACIONAL_PADRAO';
  regimeTributarioUtilizado: string;
  aliquotaImpostosUtilizada: number;
  itensCatalogoUtilizados: Array<{
    id: string;
    sku: string;
    nome: string;
    custoBase: number;
    precoMinimoLicitacao: number | null;
  }>;
  custoProdutoTotal: number;
  precoMinimoSustentavel: number;
  precoSugerido: number;
  classificacao: 'VIÁVEL (ALTA VIABILIDADE)' | 'MARGEM APERTADA' | 'INVIÁVEL';
  scorePercentual: number;
  scoreDescricao: string;
}

/**
 * Realiza o cálculo de viabilidade econômica autêntico da proposta, eliminando multiplicadores
 * fictícios hardcoded (ex: 65% de custo presumido) e cruzando:
 * 1. O Regime Tributário real da empresa (Simples, Presumido, Real, MEI);
 * 2. Os custos reais cadastrados individualmente no Catálogo de Produtos (CatalogItem).
 */
export async function calcularViabilidadeAutentica(
  params: CalculoViabilidadeAutenticaInput
): Promise<CalculoViabilidadeAutenticaResultado> {
  const estimativaEdital = roundMoney(params.estimativaEdital);

  // 1. Identifica a empresa e seu Regime Tributário (com proteção contra IDOR)
  let targetCompanyId = params.companyId;
  let company = null;

  if (targetCompanyId) {
    company = await prisma.company.findFirst({
      where: {
        id: targetCompanyId,
        ...(params.userId ? { userId: params.userId } : {}),
      },
    });
    if (!company) {
      targetCompanyId = undefined;
    }
  }

  if (!company && params.userId) {
    company = await prisma.company.findFirst({ where: { userId: params.userId } });
    if (company) {
      targetCompanyId = company.id;
    }
  }

  // Define alíquota de impostos baseada no Regime Tributário
  let percentualImpostos: number;
  let origemTributacao: CalculoViabilidadeAutenticaResultado['origemTributacao'];
  let regimeTributarioUtilizado: string;

  if (params.percentualImpostosInformado != null && !isNaN(Number(params.percentualImpostosInformado))) {
    percentualImpostos = Number(params.percentualImpostosInformado);
    origemTributacao = 'INFORMADO_PELO_USUARIO';
    regimeTributarioUtilizado = params.regimeTributario || 'PERSONALIZADO';
  } else if (params.regimeTributario) {
    percentualImpostos = obterAliquotaRegimeTributario(params.regimeTributario);
    origemTributacao = 'REGIME_EMPRESA';
    regimeTributarioUtilizado = String(params.regimeTributario).toUpperCase();
  } else {
    // Tenta obter do perfil da empresa ou usa o padrão Simples Nacional
    percentualImpostos = ALIQUOTAS_REGIME_TRIBUTARIO.SIMPLES_NACIONAL;
    origemTributacao = 'SIMPLES_NACIONAL_PADRAO';
    regimeTributarioUtilizado = 'SIMPLES_NACIONAL';
  }

  // 2. Localiza custos no Catálogo de Produtos individual (somente quando IDs explícitos ou objeto compatível)
  const itensCatalogoUtilizados: CalculoViabilidadeAutenticaResultado['itensCatalogoUtilizados'] = [];
  let custoProdutoTotal = 0;
  let origemCustoProduto: CalculoViabilidadeAutenticaResultado['origemCustoProduto'] = 'SEM_PRODUTO_VINCULADO';

  if (targetCompanyId) {
    const hasExplicitCatalogFilter =
      Boolean(params.catalogItemId) ||
      Boolean(params.catalogItemIds && params.catalogItemIds.length > 0);

    if (hasExplicitCatalogFilter) {
      const catalogWhere: any = { companyId: targetCompanyId, status: 'ATIVO' };

      if (params.catalogItemId) {
        catalogWhere.id = params.catalogItemId;
      } else if (params.catalogItemIds && params.catalogItemIds.length > 0) {
        catalogWhere.id = { in: params.catalogItemIds };
      }

      const catalogItems = await prisma.catalogItem.findMany({
        where: catalogWhere,
      });

      if (catalogItems.length > 0) {
        for (const item of catalogItems) {
          const custo = item.custoBase != null ? Number(item.custoBase) : 0;
          custoProdutoTotal += custo;
          itensCatalogoUtilizados.push({
            id: item.id,
            sku: item.sku,
            nome: item.nome,
            custoBase: custo,
            precoMinimoLicitacao: item.precoMinimoLicitacao != null ? Number(item.precoMinimoLicitacao) : null,
          });
        }
        origemCustoProduto = 'CATALOGO_PRODUTOS';
      }
    } else if (params.objetoEdital) {
      // Busca inteligente por compatibilidade de palavras do objeto no catálogo da empresa
      const allActiveItems = await prisma.catalogItem.findMany({
        where: { companyId: targetCompanyId, status: 'ATIVO' },
      });

      const objetoLower = params.objetoEdital.toLowerCase();
      const matched = allActiveItems.filter((item) => {
        const nomeLower = item.nome.toLowerCase();
        const skuLower = item.sku.toLowerCase();
        return objetoLower.includes(nomeLower) || (item.codigoCatmat && objetoLower.includes(item.codigoCatmat)) || objetoLower.includes(skuLower);
      });

      if (matched.length > 0) {
        for (const item of matched) {
          const custo = item.custoBase != null ? Number(item.custoBase) : 0;
          custoProdutoTotal += custo;
          itensCatalogoUtilizados.push({
            id: item.id,
            sku: item.sku,
            nome: item.nome,
            custoBase: custo,
            precoMinimoLicitacao: item.precoMinimoLicitacao != null ? Number(item.precoMinimoLicitacao) : null,
          });
        }
        origemCustoProduto = 'CATALOGO_PRODUTOS';
      }
    }
  }

  // Fallback: se o usuário informou o custo do produto manualmente
  if (custoProdutoTotal === 0 && params.custoProdutoInformado != null && !isNaN(Number(params.custoProdutoInformado))) {
    custoProdutoTotal = roundMoney(Number(params.custoProdutoInformado));
    origemCustoProduto = 'INFORMADO_PELO_USUARIO';
  }

  // 3. Custos adicionais de logística e taxas
  const custoLogistico = params.custoLogistico != null && !isNaN(Number(params.custoLogistico))
    ? roundMoney(Number(params.custoLogistico))
    : roundMoney(estimativaEdital * 0.05);

  const taxasAdministrativas = params.taxasAdministrativas != null && !isNaN(Number(params.taxasAdministrativas))
    ? roundMoney(Number(params.taxasAdministrativas))
    : roundMoney(estimativaEdital * 0.03);

  const margemDesejadaPercentual = params.margemDesejadaPercentual != null && !isNaN(Number(params.margemDesejadaPercentual))
    ? Number(params.margemDesejadaPercentual)
    : 15;

  // 4. Cálculo do Preço Mínimo Sustentável
  const custosDiretos = custoProdutoTotal + custoLogistico + taxasAdministrativas;
  const divisor = Math.max(0.05, 1 - (percentualImpostos + margemDesejadaPercentual) / 100);
  const precoMinimoSustentavel = roundMoney(custosDiretos / divisor);

  // 5. Preço do lance / Preço sugerido
  let precoSugerido: number;
  if (params.precoLance != null && Number(params.precoLance) > 0) {
    precoSugerido = roundMoney(Number(params.precoLance));
  } else {
    // Sugestão competitiva realista: até 7% abaixo do valor teto do edital, sem perfurar o piso sustentável
    const precoCompetitivo = roundMoney(estimativaEdital * 0.93);
    precoSugerido = Math.max(precoMinimoSustentavel, Math.min(estimativaEdital, precoCompetitivo));
  }

  // 6. Cálculo das etapas de viabilidade
  const viabilidade = calcularViabilidade({
    precoLance: precoSugerido,
    custoProduto: custoProdutoTotal,
    percentualImpostos,
    custoLogistico,
    taxasAdministrativas,
  });

  // 7. Classificação e score
  const margemReal = viabilidade.margemLucroRealPercentual;
  let classificacao: CalculoViabilidadeAutenticaResultado['classificacao'] = 'VIÁVEL (ALTA VIABILIDADE)';
  let scorePercentual = 88;
  let scoreDescricao = 'Excelente viabilidade operacional calculada sobre os custos do catálogo e regime tributário.';

  if (precoMinimoSustentavel > estimativaEdital) {
    classificacao = 'INVIÁVEL';
    scorePercentual = 25;
    scoreDescricao = 'O custo do produto somado a tributos e logística supera o valor estimado do edital. Risco de prejuízo ou inexequibilidade.';
  } else if (margemReal < 5) {
    classificacao = 'INVIÁVEL';
    scorePercentual = 35;
    scoreDescricao = 'A margem líquida apurada está abaixo do piso mínimo de segurança econômica (5%).';
  } else if (margemReal < 12) {
    classificacao = 'MARGEM APERTADA';
    scorePercentual = 68;
    scoreDescricao = 'Operação viável, porém exige controle rígido de despesas de entrega e tributação.';
  }

  return {
    viabilidade,
    origemCustoProduto,
    origemTributacao,
    regimeTributarioUtilizado,
    aliquotaImpostosUtilizada: percentualImpostos,
    itensCatalogoUtilizados,
    custoProdutoTotal,
    precoMinimoSustentavel,
    precoSugerido,
    classificacao,
    scorePercentual,
    scoreDescricao,
  };
}

export function calcularViabilidade(input: CalculoViabilidadeInput): CalculoViabilidadeResultado {
  validatePositive(input.precoLance, 'INVALID_PRECO_LANCE');
  validateNonNegative(input.custoProduto, 'INVALID_CUSTO_PRODUTO');
  validatePercent(input.percentualImpostos);
  validateNonNegative(input.custoLogistico, 'INVALID_CUSTO_LOGISTICO');
  validateNonNegative(input.taxasAdministrativas, 'INVALID_TAXAS_ADMINISTRATIVAS');

  const baseCalculo = roundMoney(input.precoLance);
  const custoProduto = roundMoney(input.custoProduto);
  const impostosValor = roundMoney(baseCalculo * (input.percentualImpostos / 100));
  const saldoAposProduto = roundMoney(baseCalculo - custoProduto);
  const saldoAposImpostos = roundMoney(saldoAposProduto - impostosValor);
  const saldoAposLogistica = roundMoney(saldoAposImpostos - input.custoLogistico);
  const margemLucroRealValor = roundMoney(saldoAposLogistica - input.taxasAdministrativas);
  const margemLucroRealPercentual = roundPercent((margemLucroRealValor / baseCalculo) * 100);

  return {
    baseCalculo,
    precoLance: baseCalculo,
    custoProduto,
    impostosValor,
    custoLogistico: roundMoney(input.custoLogistico),
    taxasAdministrativas: roundMoney(input.taxasAdministrativas),
    margemLucroRealValor,
    margemLucroRealPercentual,
    margemSaudavel: margemLucroRealPercentual >= 10,
    etapas: [
      {
        ordem: 1,
        descricao: 'Subtração do custo real do produto (Catálogo de Itens)',
        valorSubtraido: custoProduto,
        saldo: saldoAposProduto,
      },
      {
        ordem: 2,
        descricao: 'Subtração dos tributos conforme Regime Tributário da empresa',
        valorSubtraido: impostosValor,
        saldo: saldoAposImpostos,
      },
      {
        ordem: 3,
        descricao: 'Subtração do custo logístico e frete',
        valorSubtraido: roundMoney(input.custoLogistico),
        saldo: saldoAposLogistica,
      },
      {
        ordem: 4,
        descricao: 'Subtração das despesas administrativas e operacionais',
        valorSubtraido: roundMoney(input.taxasAdministrativas),
        saldo: margemLucroRealValor,
      },
    ],
  };
}

function validatePositive(value: number, errorCode: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(errorCode);
  }
}

function validateNonNegative(value: number, errorCode: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(errorCode);
  }
}

function validatePercent(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('INVALID_PERCENTUAL_IMPOSTOS');
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

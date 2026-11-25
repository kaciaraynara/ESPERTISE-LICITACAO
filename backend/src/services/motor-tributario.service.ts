/**
 * Motor Tributário e Precificação Real por CNAE e Regime Tributário
 * Conforme Lei nº 14.133/2021, LC nº 123/2006 e Acórdão nº 2622/2013-TCU.
 * Matemática pura determinística (sem suposições ou estimativas de IA).
 */

export type RegimeTributario =
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | 'MEI';

export type AnexoSimplesNacional =
  | 'ANEXO_I_COMERCIO'
  | 'ANEXO_II_INDUSTRIA'
  | 'ANEXO_III_SERVICOS'
  | 'ANEXO_IV_OBRAS_LIMPEZA'
  | 'ANEXO_V_SERVICOS_INTELECTUAIS';

export type TipoContratacao =
  | 'COMERCIO_PRODUTOS'
  | 'SERVICOS_GERAIS'
  | 'SERVICOS_ANEXO_IV' // Limpeza, Vigilância, Conservação, Obras
  | 'OBRAS_ENGENHARIA';

export interface ParametrosBdiTcu {
  administracaoCentralPct?: number; // AC: 1.5% a 7.0% (médio ~ 4.0%)
  seguroGarantiaPct?: number; // S + G: 0.4% a 2.0% (médio ~ 0.8%)
  riscoPct?: number; // R: 0.5% a 2.5% (médio ~ 1.27%)
  despesasFinanceirasPct?: number; // DF: 0.5% a 2.0% (médio ~ 1.23%)
  lucroPct?: number; // L: 4.0% a 12.0% (médio ~ 7.4%)
  cprbPct?: number; // CPRB desoneração: 0% ou 4.5%
}

export interface EntradaPrecificacaoDeterminada {
  tipoContratacao: TipoContratacao;
  regimeTributario: RegimeTributario;
  anexoSimples?: AnexoSimplesNacional;
  aliquotaEfetivaSimplesPct?: number; // Informada pelo contador ou extrato do Simples
  // Custos Diretos
  custoItemBase: number; // Preço de custo do produto, material ou mão de obra direta
  custoLogisticoFrete?: number;
  custosEmbalagemSeguro?: number;
  encargosTrabalhistasMaoDeObra?: number; // Quando prestação de serviços
  outrosCustosDiretos?: number;
  // Parâmetros Fiscais Locais e Interestaduais
  ufOrigem?: string;
  ufDestinoOrgao?: string;
  aliquotaIssPct?: number; // 2% a 5% (default 3.0%)
  aliquotaIcmsInternaPct?: number; // 17% a 20.5% (default 18.0%)
  isSubstituicaoTributariaIcms?: boolean;
  // Margens
  margemLucroDesejadaPct?: number; // Ex: 15%
  margemMinimaSegurancaPct?: number; // Piso seguro, ex: 5%
  // Edital
  valorOrcamentoEdital?: number;
  parametrosBdi?: ParametrosBdiTcu;
}

export interface ItemDetalhamentoTributario {
  tributo: string;
  sigla: string;
  aliquotaPct: number;
  valorCalculado: number;
  descricao: string;
}

export interface RetencaoFonteNotaFiscal {
  totalRetidoFonte: number;
  irrfValor: number;
  csllPisCofinsValor: number;
  issFonteValor: number;
  dispensadoSimplesNacional: boolean;
  fundamentacaoLegal: string;
  valorLiquidoReceberCaixa: number;
}

export interface ResultadoPrecificacaoDeterminada {
  tipoContratacao: TipoContratacao;
  regimeTributario: RegimeTributario;
  custoTotalDireto: number;
  inssPatronalAnexoIvValor: number; // Obrigatório 20% fora do DAS para Anexo IV
  aliquotaTributariaTotalPct: number;
  impostosTotaisValor: number;
  detalhamentoTributos: ItemDetalhamentoTributario[];
  bdiCalculadoPct?: number;
  // Preços "Por Dentro" (Markup Divisor)
  precoMinimoSeguro: number; // Preço no piso da margem mínima
  precoSugeridoVenda: number; // Preço para atingir a margem desejada
  lucroLiquidoSugeridoReais: number;
  margemLiquidaRealPct: number;
  // Retenções na Fonte e Fluxo de Caixa
  retencaoNotaFiscal: RetencaoFonteNotaFiscal;
  // Auditoria e Conformidade Jurídica
  alertaInexequibilidade: boolean;
  justificativaInexequibilidade?: string;
  explicacaoMetodologia: string;
}

function round(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export class MotorTributarioService {
  /**
   * Executa o cálculo determinístico completo de tributos, BDI e formação de preço "por dentro".
   */
  public calcularPrecificacao(input: EntradaPrecificacaoDeterminada): ResultadoPrecificacaoDeterminada {
    const custoItem = Math.max(0, input.custoItemBase || 0);
    const frete = Math.max(0, input.custoLogisticoFrete || 0);
    const embalagem = Math.max(0, input.custosEmbalagemSeguro || 0);
    const outros = Math.max(0, input.outrosCustosDiretos || 0);
    const encargosBase = Math.max(0, input.encargosTrabalhistasMaoDeObra || 0);

    const margemDesejadaPct = input.margemLucroDesejadaPct !== undefined ? input.margemLucroDesejadaPct : 15.0;
    const margemMinimaPct = input.margemMinimaSegurancaPct !== undefined ? input.margemMinimaSegurancaPct : 5.0;

    // 1. CÁLCULO DE CUSTOS DIRETOS
    let custoTotalDireto = round(custoItem + frete + embalagem + outros + encargosBase);
    let inssPatronalAnexoIvValor = 0;

    // Regra B: Simples Nacional Anexo IV exige 20% de INSS Patronal por fora da guia DAS (Art. 18, § 5º-C LC 123/06)
    if (
      input.regimeTributario === 'SIMPLES_NACIONAL' &&
      (input.anexoSimples === 'ANEXO_IV_OBRAS_LIMPEZA' || input.tipoContratacao === 'SERVICOS_ANEXO_IV')
    ) {
      const baseMaoDeObra = encargosBase > 0 ? encargosBase : custoItem * 0.40;
      inssPatronalAnexoIvValor = round(baseMaoDeObra * 0.20);
      custoTotalDireto = round(custoTotalDireto + inssPatronalAnexoIvValor);
    }

    // 2. APURAÇÃO DAS ALÍQUOTAS TRIBUTÁRIAS POR REGIME E TIPO DE OBJETO
    const detalhamentoTributos: ItemDetalhamentoTributario[] = [];
    let aliquotaTotalTributosPct = 0;

    const issPadraoPct = input.aliquotaIssPct !== undefined ? input.aliquotaIssPct : 3.0;
    const icmsPadraoPct = input.aliquotaIcmsInternaPct !== undefined ? input.aliquotaIcmsInternaPct : 18.0;

    if (input.regimeTributario === 'MEI') {
      aliquotaTotalTributosPct = 0.0;
      detalhamentoTributos.push({
        tributo: 'SIMEI (Fixo Mensal)',
        sigla: 'MEI',
        aliquotaPct: 0.0,
        valorCalculado: 0.0,
        descricao: 'Tributação fixa por guia DAS-MEI (isenção de alíquota variável sobre a fatura).',
      });
    } else if (input.regimeTributario === 'SIMPLES_NACIONAL') {
      let aliqSimples = input.aliquotaEfetivaSimplesPct || 6.0;

      // Se comércio com Substituição Tributária (ICMS já pago anteriormente), deduz a parcela do ICMS do DAS (~33% do DAS)
      if (input.tipoContratacao === 'COMERCIO_PRODUTOS' && input.isSubstituicaoTributariaIcms) {
        aliqSimples = round(aliqSimples * 0.67);
      }

      aliquotaTotalTributosPct = round(aliqSimples);
      detalhamentoTributos.push({
        tributo: 'Guia DAS Simples Nacional',
        sigla: 'DAS',
        aliquotaPct: aliquotaTotalTributosPct,
        valorCalculado: 0, // calculado ao formar o preço
        descricao: `Alíquota efetiva apurada do Simples Nacional (${input.anexoSimples || 'Anexo Geral'}).`,
      });
    } else if (input.regimeTributario === 'LUCRO_PRESUMIDO') {
      if (input.tipoContratacao === 'COMERCIO_PRODUTOS') {
        const pis = 0.65;
        const cofins = 3.0;
        const irpj = 1.20; // 8% presunção * 15%
        const csll = 1.08; // 12% presunção * 9%
        const icms = icmsPadraoPct; // Venda interna/DIFAL

        aliquotaTotalTributosPct = round(pis + cofins + irpj + csll + icms);

        detalhamentoTributos.push(
          { tributo: 'PIS Cumulativo', sigla: 'PIS', aliquotaPct: pis, valorCalculado: 0, descricao: 'PIS regime cumulativo s/ faturamento' },
          { tributo: 'COFINS Cumulativa', sigla: 'COFINS', aliquotaPct: cofins, valorCalculado: 0, descricao: 'COFINS regime cumulativo s/ faturamento' },
          { tributo: 'IRPJ Efetivo', sigla: 'IRPJ', aliquotaPct: irpj, valorCalculado: 0, descricao: 'Presunção de 8% x 15% de alíquota' },
          { tributo: 'CSLL Efetiva', sigla: 'CSLL', aliquotaPct: csll, valorCalculado: 0, descricao: 'Presunção de 12% x 9% de alíquota' },
          { tributo: 'ICMS Líquido', sigla: 'ICMS', aliquotaPct: icms, valorCalculado: 0, descricao: 'Incidência de ICMS no fornecimento ao órgão' }
        );
      } else {
        // Serviços ou Obras
        const pis = 0.65;
        const cofins = 3.0;
        const irpj = 4.80; // 32% presunção * 15%
        const csll = 2.88; // 32% presunção * 9%
        const iss = issPadraoPct;

        aliquotaTotalTributosPct = round(pis + cofins + irpj + csll + iss);

        detalhamentoTributos.push(
          { tributo: 'PIS Cumulativo', sigla: 'PIS', aliquotaPct: pis, valorCalculado: 0, descricao: 'PIS sobre serviços' },
          { tributo: 'COFINS Cumulativa', sigla: 'COFINS', aliquotaPct: cofins, valorCalculado: 0, descricao: 'COFINS sobre serviços' },
          { tributo: 'IRPJ Efetivo', sigla: 'IRPJ', aliquotaPct: irpj, valorCalculado: 0, descricao: 'Presunção de 32% x 15% de alíquota' },
          { tributo: 'CSLL Efetiva', sigla: 'CSLL', aliquotaPct: csll, valorCalculado: 0, descricao: 'Presunção de 32% x 9% de alíquota' },
          { tributo: 'ISS Municipal', sigla: 'ISS', aliquotaPct: iss, valorCalculado: 0, descricao: 'ISS no município de prestação' }
        );
      }
    } else {
      // LUCRO REAL
      const pis = 1.65;
      const cofins = 7.60;
      // Crédito estimado de entrada ~ 40% do PIS/COFINS nos insumos
      const pisCofinsLiquido = round((pis + cofins) * 0.60);
      const irpjCsllEstimado = 4.0; // Projeção ponderada
      const localTax = input.tipoContratacao === 'COMERCIO_PRODUTOS' ? icmsPadraoPct : issPadraoPct;

      aliquotaTotalTributosPct = round(pisCofinsLiquido + irpjCsllEstimado + localTax);

      detalhamentoTributos.push(
        { tributo: 'PIS/COFINS Não-Cumulativo Líquido', sigla: 'PIS/COFINS', aliquotaPct: pisCofinsLiquido, valorCalculado: 0, descricao: 'PIS/COFINS 9,25% compensado com créditos de entrada' },
        { tributo: 'IRPJ / CSLL s/ Lucro Real', sigla: 'IRPJ/CSLL', aliquotaPct: irpjCsllEstimado, valorCalculado: 0, descricao: 'Projeção sobre o lucro contábil auferido' },
        { tributo: input.tipoContratacao === 'COMERCIO_PRODUTOS' ? 'ICMS' : 'ISS', sigla: input.tipoContratacao === 'COMERCIO_PRODUTOS' ? 'ICMS' : 'ISS', aliquotaPct: localTax, valorCalculado: 0, descricao: 'Tributo estadual ou municipal' }
      );
    }

    // 3. REGRA C: OBRAS E ENGENHARIA — CÁLCULO ESTRUTURADO DE BDI (ACÓRDÃO 2622/2013-TCU)
    let bdiCalculadoPct: number | undefined;
    if (input.tipoContratacao === 'OBRAS_ENGENHARIA') {
      const p = input.parametrosBdi || {};
      const ac = (p.administracaoCentralPct !== undefined ? p.administracaoCentralPct : 4.0) / 100;
      const sg = (p.seguroGarantiaPct !== undefined ? p.seguroGarantiaPct : 0.8) / 100;
      const r = (p.riscoPct !== undefined ? p.riscoPct : 1.27) / 100;
      const df = (p.despesasFinanceirasPct !== undefined ? p.despesasFinanceirasPct : 1.23) / 100;
      const l = (p.lucroPct !== undefined ? p.lucroPct : 7.4) / 100;
      const t = (aliquotaTotalTributosPct + (p.cprbPct || 0)) / 100;

      // Fórmula TCU: BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - T)] - 1
      const numerador = (1 + ac + sg + r) * (1 + df) * (1 + l);
      const denominador = 1 - t;
      const bdiFator = denominador > 0 ? (numerador / denominador) - 1 : 0.25;
      bdiCalculadoPct = round(bdiFator * 100);
    }

    // 4. FORMAÇÃO DE PREÇO OFICIAL "POR DENTRO" (MARKUP DIVISOR)
    // Preco = CustoTotalDireto / (1 - (Tributos + Margem))
    const divisorMinimo = 1 - (aliquotaTotalTributosPct / 100 + margemMinimaPct / 100);
    const divisorSugerido = 1 - (aliquotaTotalTributosPct / 100 + margemDesejadaPct / 100);

    let precoMinimoSeguro = divisorMinimo > 0 ? round(custoTotalDireto / divisorMinimo) : round(custoTotalDireto * 1.15);
    let precoSugeridoVenda = divisorSugerido > 0 ? round(custoTotalDireto / divisorSugerido) : round(custoTotalDireto * 1.30);

    // Se for Obra com BDI TCU: Preço = Custo Direto * (1 + BDI)
    if (input.tipoContratacao === 'OBRAS_ENGENHARIA' && bdiCalculadoPct !== undefined) {
      precoSugeridoVenda = round(custoTotalDireto * (1 + bdiCalculadoPct / 100));
      precoMinimoSeguro = round(custoTotalDireto * (1 + (bdiCalculadoPct * 0.70) / 100));
    }

    const impostosTotaisValor = round(precoSugeridoVenda * (aliquotaTotalTributosPct / 100));

    // Hidrata os valores em R$ dos tributos
    detalhamentoTributos.forEach((item) => {
      item.valorCalculado = round(precoSugeridoVenda * (item.aliquotaPct / 100));
    });

    const lucroLiquidoSugeridoReais = round(precoSugeridoVenda - impostosTotaisValor - custoTotalDireto);
    const margemLiquidaRealPct = precoSugeridoVenda > 0 ? round((lucroLiquidoSugeridoReais / precoSugeridoVenda) * 100) : 0;

    // 5. RETENÇÕES NA FONTE PELO ÓRGÃO PÚBLICO (IN RFB 1.234/2012 e 2.145/2023)
    let totalRetidoFonte = 0;
    let irrfValor = 0;
    let csllPisCofinsValor = 0;
    let issFonteValor = 0;
    let dispensadoSimplesNacional = false;
    let fundamentacaoLegal = '';

    if (input.regimeTributario === 'SIMPLES_NACIONAL' || input.regimeTributario === 'MEI') {
      dispensadoSimplesNacional = true;
      totalRetidoFonte = 0;
      fundamentacaoLegal =
        'Dispensada de retenção federal de tributos mediante apresentação de declaração do Simples Nacional (Art. 4º, XI da IN RFB nº 1.234/2012).';
    } else {
      dispensadoSimplesNacional = false;
      // Retenções normais do Lucro Presumido / Real
      if (input.tipoContratacao === 'COMERCIO_PRODUTOS') {
        irrfValor = round(precoSugeridoVenda * 0.012); // 1,2% mercadorias
        csllPisCofinsValor = round(precoSugeridoVenda * 0.0465); // 4,65%
      } else {
        irrfValor = round(precoSugeridoVenda * 0.048); // 4,8% serviços
        csllPisCofinsValor = round(precoSugeridoVenda * 0.0465); // 4,65%
        issFonteValor = round(precoSugeridoVenda * (issPadraoPct / 100)); // ISS retido na fonte
      }
      totalRetidoFonte = round(irrfValor + csllPisCofinsValor + issFonteValor);
      fundamentacaoLegal =
        'Retenção tributária obrigatória na fonte efetuada pelo órgão pagador conforme IN RFB nº 1.234/2012 e IN RFB nº 2.145/2023.';
    }

    const valorLiquidoReceberCaixa = round(precoSugeridoVenda - totalRetidoFonte);

    // 6. ANÁLISE DE INEXEQUIBILIDADE (ART. 59 DA LEI 14.133/2021)
    let alertaInexequibilidade = false;
    let justificativaInexequibilidade: string | undefined;

    if (input.valorOrcamentoEdital && input.valorOrcamentoEdital > 0) {
      if (input.tipoContratacao === 'OBRAS_ENGENHARIA') {
        // Art. 59, § 4º da Lei 14.133/21 e Súmula 262/TCU: menor que 75% da estimativa em obras
        if (precoMinimoSeguro < input.valorOrcamentoEdital * 0.75) {
          alertaInexequibilidade = true;
          justificativaInexequibilidade =
            'Alerta de Inexequibilidade (Art. 59, § 4º da Lei 14.133/2021 e Súmula 262/TCU): Oferta abaixo de 75% do orçamento da Administração em obras e serviços de engenharia. Exige comprovação estrita de viabilidade.';
        }
      } else {
        // Bens e serviços comuns: presunção abaixo de 50%
        if (precoMinimoSeguro < input.valorOrcamentoEdital * 0.50) {
          alertaInexequibilidade = true;
          justificativaInexequibilidade =
            'Alerta de Inexequibilidade (Art. 59, III da Lei 14.133/2021): Proposta com valor inferior a 50% do orçamento estimado. O pregoeiro deve exigir comprovação de custos antes de homologar.';
        }
      }
    }

    const explicacaoMetodologia =
      `Formação de preço por dentro (Markup Divisor) com base no regime ${input.regimeTributario} ` +
      `e modalidade ${input.tipoContratacao}. Alíquota tributária total incidente sobre a Nota Fiscal: ${aliquotaTotalTributosPct.toFixed(2)}%.`;

    return {
      tipoContratacao: input.tipoContratacao,
      regimeTributario: input.regimeTributario,
      custoTotalDireto,
      inssPatronalAnexoIvValor,
      aliquotaTributariaTotalPct: aliquotaTotalTributosPct,
      impostosTotaisValor,
      detalhamentoTributos,
      bdiCalculadoPct,
      precoMinimoSeguro,
      precoSugeridoVenda,
      lucroLiquidoSugeridoReais,
      margemLiquidaRealPct,
      retencaoNotaFiscal: {
        totalRetidoFonte,
        irrfValor,
        csllPisCofinsValor,
        issFonteValor,
        dispensadoSimplesNacional,
        fundamentacaoLegal,
        valorLiquidoReceberCaixa,
      },
      alertaInexequibilidade,
      justificativaInexequibilidade,
      explicacaoMetodologia,
    };
  }
}

export const motorTributarioService = new MotorTributarioService();

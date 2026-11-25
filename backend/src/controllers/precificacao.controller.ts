import { Request, Response } from 'express';
import { calcularViabilidade } from '../services/viabilidade.service';
import { motorTributarioService } from '../services/motor-tributario.service';
import { prisma } from '../database/prisma';

export class PrecificacaoController {
  /**
   * POST /api/v1/precificacao/motor-tributario
   * Executa o cálculo determinístico conforme Lei 14.133/21, LC 123/06 e Acórdão 2622/13-TCU.
   */
  async calcularMotorTributario(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const companyId = body.companyId || (req as any).companyId;

      let regimeTributario = body.regimeTributario || 'SIMPLES_NACIONAL';
      let anexoSimples = body.anexoSimples || 'ANEXO_I_COMERCIO';
      let aliquotaEfetivaSimples = Number(body.aliquotaEfetivaSimples ?? 6.0);
      let tipoContratacao = body.tipoContratacao || 'COMERCIO_PRODUTOS';
      let ufOrigem = body.ufOrigem || 'SP';
      let ufDestino = body.ufDestino || 'SP';
      let aliquotaIss = Number(body.aliquotaIss ?? 3.0);
      let aliquotaIcms = Number(body.aliquotaIcms ?? 18.0);
      let isSubstituicaoTributaria = Boolean(body.isSubstituicaoTributariaIcms ?? false);

      if (companyId) {
        const comp = await prisma.company.findUnique({
          where: { id: String(companyId) },
        });
        if (comp) {
          regimeTributario = comp.regimeTributario || regimeTributario;
          anexoSimples = comp.anexoSimples || anexoSimples;
          if (comp.aliquotaEfetivaSimples) aliquotaEfetivaSimples = Number(comp.aliquotaEfetivaSimples);
          if (comp.uf) ufOrigem = comp.uf;
          if (comp.aliquotaIssPadrao) aliquotaIss = Number(comp.aliquotaIssPadrao);
          if (comp.aliquotaIcmsInterna) aliquotaIcms = Number(comp.aliquotaIcmsInterna);
          isSubstituicaoTributaria = comp.regimeSubstituicaoTributaria ?? isSubstituicaoTributaria;

          // Dedução automática de tipo de contratação pelo CNAE da empresa se não fornecido
          if (!body.tipoContratacao && comp.cnaePrincipal) {
            const cnae = comp.cnaePrincipal.replace(/\D/g, '');
            if (cnae.startsWith('41') || cnae.startsWith('42') || cnae.startsWith('43')) {
              tipoContratacao = 'OBRAS_ENGENHARIA';
            } else if (cnae.startsWith('81') || cnae.startsWith('80')) {
              tipoContratacao = 'SERVICOS_ANEXO_IV';
            } else if (cnae.startsWith('45') || cnae.startsWith('46') || cnae.startsWith('47')) {
              tipoContratacao = 'COMERCIO_PRODUTOS';
            } else {
              tipoContratacao = 'SERVICOS_GERAIS';
            }
          }
        }
      }

      const resultado = motorTributarioService.calcularPrecificacao({
        tipoContratacao,
        regimeTributario,
        anexoSimples,
        aliquotaEfetivaSimplesPct: aliquotaEfetivaSimples,
        custoItemBase: Number(body.custoItemBase ?? body.custoProdutoServico ?? 100),
        custoLogisticoFrete: Number(body.custoLogisticoFrete ?? body.frete ?? 0),
        custosEmbalagemSeguro: Number(body.custosEmbalagemSeguro ?? 0),
        encargosTrabalhistasMaoDeObra: Number(body.encargosTrabalhistasMaoDeObra ?? 0),
        outrosCustosDiretos: Number(body.outrosCustosDiretos ?? 0),
        ufOrigem,
        ufDestinoOrgao: ufDestino,
        aliquotaIssPct: aliquotaIss,
        aliquotaIcmsInternaPct: aliquotaIcms,
        isSubstituicaoTributariaIcms: isSubstituicaoTributaria,
        margemLucroDesejadaPct: Number(body.margemLucroDesejadaPct ?? body.margemDesejadaPercentual ?? 15.0),
        margemMinimaSegurancaPct: Number(body.margemMinimaSegurancaPct ?? 5.0),
        valorOrcamentoEdital: body.valorOrcamentoEdital ? Number(body.valorOrcamentoEdital) : undefined,
        parametrosBdi: body.parametrosBdi,
      });

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Erro ao calcular motor tributário determinístico.',
      });
    }
  }

  /**
   * POST /api/v1/precificacao/viabilidade
   * Suporta tanto o payload de PrecificacaoPage.tsx ({ custoProdutoServico, impostosPercentual, custoOperacionalPercentual, margemDesejadaPercentual })
   * quanto o payload de CalculadoraViabilidade.tsx ({ preco_lance, custo_produto, percentual_impostos, custo_logistico, taxas_administrativas }).
   */
  async calcularMargens(req: Request, res: Response) {
    try {
      const body = req.body ?? {};

      // Caso 1: Payload da CalculadoraViabilidade.tsx (snake_case / camelCase com preco_lance)
      if (body.preco_lance !== undefined || body.precoLance !== undefined) {
        const precoLance = Number(body.preco_lance ?? body.precoLance ?? 0);
        const custoProduto = Number(body.custo_produto ?? body.custoProduto ?? 0);
        const percentualImpostos = Number(body.percentual_impostos ?? body.percentualImpostos ?? 0);
        const custoLogistico = Number(body.custo_logistico ?? body.custoLogistico ?? 0);
        const taxasAdministrativas = Number(body.taxas_administrativas ?? body.taxasAdministrativas ?? 0);

        if (!Number.isFinite(precoLance) || precoLance <= 0) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PRECO_LANCE',
            message: 'Informe um preço de lance maior que zero.',
          });
        }

        const resultado = calcularViabilidade({
          precoLance,
          custoProduto: Math.max(0, custoProduto),
          percentualImpostos: Math.min(100, Math.max(0, percentualImpostos)),
          custoLogistico: Math.max(0, custoLogistico),
          taxasAdministrativas: Math.max(0, taxasAdministrativas),
        });

        const custoBase = resultado.custoProduto + resultado.custoLogistico + resultado.taxasAdministrativas;
        const fatorBreakeven = 1 - percentualImpostos / 100;
        const precoBreakeven = fatorBreakeven > 0 ? Number((custoBase / fatorBreakeven).toFixed(2)) : custoBase;

        const statusViabilidade =
          resultado.margemLucroRealPercentual >= 12
            ? 'VIAVEL'
            : resultado.margemLucroRealPercentual >= 5
              ? 'ALERTA'
              : 'INVIAVEL';

        return res.json({
          success: true,
          data: {
            ...resultado,
            lucroLiquidoReais: resultado.margemLucroRealValor,
            statusViabilidade,
            precoSugerido: resultado.precoLance,
            precoBreakeven,
            lucroProjetado: resultado.margemLucroRealValor,
            impostoProjetado: resultado.impostosValor,
          },
        });
      }

      // Caso 2: Payload da PrecificacaoPage.tsx ({ custoProdutoServico, impostosPercentual, custoOperacionalPercentual, margemDesejadaPercentual })
      const custoProdutoServico = Number(body.custoProdutoServico ?? 0);
      const impostosPercentual = Number(body.impostosPercentual ?? 0);
      const custoOperacionalPercentual = Number(body.custoOperacionalPercentual ?? 0);
      const margemDesejadaPercentual = Number(body.margemDesejadaPercentual ?? 0);

      const CAMPOS_CUSTOS_DETALHADOS = [
        'prolabore',
        'dinheiroEmpresa',
        'funcionarios',
        'viagemEstadias',
        'fabricacao',
        'manutencaoSoftware',
        'despesasAdministrativas',
      ] as const;

      const detalhadosRaw = body.custosIndiretosDetalhados ?? {};
      const custosIndiretosDetalhados: Record<string, number> = {};
      for (const campo of CAMPOS_CUSTOS_DETALHADOS) {
        const rawVal = detalhadosRaw?.[campo];
        const valor = rawVal === '' || rawVal === null || rawVal === undefined ? 0 : Number(rawVal);
        if (!Number.isFinite(valor) || valor < 0) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_CUSTO_DETALHADO',
            message: `O custo "${campo}" deve ser um valor numérico não negativo.`,
          });
        }
        custosIndiretosDetalhados[campo] = Number(valor.toFixed(2));
      }

      const valoresInformados = [
        custoProdutoServico,
        impostosPercentual,
        custoOperacionalPercentual,
        margemDesejadaPercentual,
      ];
      if (valoresInformados.some((valor) => !Number.isFinite(valor) || valor < 0)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PRECIFICACAO_INPUT',
          message: 'Informe valores numéricos não negativos para custo, impostos, operação e margem.',
        });
      }
      if (impostosPercentual >= 100 || custoOperacionalPercentual > 100 || margemDesejadaPercentual >= 100) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PRECIFICACAO_PERCENTUAL',
          message: 'Alíquotas e margens devem ser menores que 100%.',
        });
      }
      if (impostosPercentual + margemDesejadaPercentual >= 100) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_COMBINACAO_IMPOSTOS_MARGEM',
          message: 'Impostos + margem não podem somar 100% ou mais.',
        });
      }

      const custoOperacionalVal = Number(
        (custoProdutoServico * (custoOperacionalPercentual / 100)).toFixed(2),
      );
      const custosIndiretosFixos = Number(
        Object.values(custosIndiretosDetalhados)
          .reduce((acc, valor) => acc + valor, 0)
          .toFixed(2),
      );
      const custosIndiretosValor = Number((custoOperacionalVal + custosIndiretosFixos).toFixed(2));
      const custoBase = Number((custoProdutoServico + custosIndiretosValor).toFixed(2));

      const fatorDivisor = 1 - (impostosPercentual + margemDesejadaPercentual) / 100;
      const precoSugerido = fatorDivisor > 0 ? Number((custoBase / fatorDivisor).toFixed(2)) : 0;

      const fatorBreakeven = 1 - impostosPercentual / 100;
      const precoBreakeven = fatorBreakeven > 0 ? Number((custoBase / fatorBreakeven).toFixed(2)) : 0;

      const lucroProjetado = Number((precoSugerido * (margemDesejadaPercentual / 100)).toFixed(2));
      const impostoProjetado = Number((precoSugerido * (impostosPercentual / 100)).toFixed(2));

      return res.json({
        success: true,
        data: {
          precoSugerido,
          precoBreakeven,
          lucroProjetado,
          impostoProjetado,
          custoProdutoServico: Number(custoProdutoServico.toFixed(2)),
          custoOperacionalVal,
          custosIndiretosFixos,
          custosIndiretosValor,
          custosIndiretosDetalhados,
          custoBase,
          margemLucroRealValor: lucroProjetado,
          margemLucroRealPercentual: margemDesejadaPercentual,
          lucroLiquidoReais: lucroProjetado,
          margemSaudavel: margemDesejadaPercentual >= 12 && fatorDivisor > 0,
          statusViabilidade:
            fatorDivisor <= 0
              ? 'INVIAVEL'
              : margemDesejadaPercentual >= 12
                ? 'VIAVEL'
                : margemDesejadaPercentual >= 5
                  ? 'ALERTA'
                  : 'INVIAVEL',
        },
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Erro ao efetuar cálculo de precificação',
      });
    }
  }
}
export default PrecificacaoController;

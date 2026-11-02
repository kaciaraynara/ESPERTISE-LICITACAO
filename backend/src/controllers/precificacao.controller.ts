import { Request, Response } from 'express';
import { calcularViabilidade } from '../services/viabilidade.service';

export class PrecificacaoController {
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

      const custoOperacionalVal = custoProdutoServico * (custoOperacionalPercentual / 100);
      const custoBase = custoProdutoServico + custoOperacionalVal;

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
          margemLucroRealValor: lucroProjetado,
          margemLucroRealPercentual: margemDesejadaPercentual,
          lucroLiquidoReais: lucroProjetado,
          margemSaudavel: margemDesejadaPercentual >= 10 && fatorDivisor > 0,
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

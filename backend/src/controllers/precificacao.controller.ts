import { Request, Response } from 'express';

interface ComposicaoCustos {
  custoProdutoServico: number;
  impostosPercentual: number;
  custoOperacionalPercentual: number;
  margemDesejadaPercentual: number;
}

export class PrecificacaoController {

  async calcularMargens(req: Request, res: Response) {
    try {
      const { custoProdutoServico, impostosPercentual, custoOperacionalPercentual, margemDesejadaPercentual }: ComposicaoCustos = req.body;

      const custoOperacionalVal = custoProdutoServico * (custoOperacionalPercentual / 100);
      const custoBase = custoProdutoServico + custoOperacionalVal;
      
      const fatorDivisor = 1 - ((impostosPercentual + margemDesejadaPercentual) / 100);
      const precoSugerido = fatorDivisor > 0 ? custoBase / fatorDivisor : 0;
      
      const fatorBreakeven = 1 - (impostosPercentual / 100);
      const precoBreakeven = fatorBreakeven > 0 ? custoBase / fatorBreakeven : 0;

      return res.json({
        success: true,
        data: {
          precoSugerido,
          precoBreakeven,
          lucroProjetado: precoSugerido * (margemDesejadaPercentual / 100),
          impostoProjetado: precoSugerido * (impostosPercentual / 100)
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao efetuar cálculo de precificação' });
    }
  }
}
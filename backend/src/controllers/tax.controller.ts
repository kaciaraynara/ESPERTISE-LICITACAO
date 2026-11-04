import { Request, Response } from 'express';
import { calcularSimulacaoBdi } from '../services/tax-bdi.service';
import { SimulateBdiInput } from '../types/war-room.types';

export class TaxController {
  /**
   * POST /api/tax/simulate-bdi (e /api/v1/tax/simulate-bdi)
   * Simula o BDI, retenções de Split Payment (CBS 11,3% e IBS 0,1%) e o piso de Stop-Loss.
   */
  public simulateBdi = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { custoInsumos, despesasOperacionais, margemLucroDesejada, margemMinimaStopLoss, bidAmount } = req.body;

      if (custoInsumos === undefined || isNaN(Number(custoInsumos))) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          message: 'O campo custoInsumos é obrigatório e deve ser um número válido.',
        });
      }

      const input: SimulateBdiInput = {
        custoInsumos: Number(custoInsumos),
        despesasOperacionais: despesasOperacionais !== undefined ? Number(despesasOperacionais) : undefined,
        margemLucroDesejada: margemLucroDesejada !== undefined ? Number(margemLucroDesejada) : undefined,
        margemMinimaStopLoss: margemMinimaStopLoss !== undefined ? Number(margemMinimaStopLoss) : undefined,
        bidAmount: bidAmount !== undefined ? Number(bidAmount) : undefined,
      };

      const result = calcularSimulacaoBdi(input);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na simulação de BDI:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_TAX_CALCULATION_ERROR',
        message: 'Falha ao processar simulação tributária de BDI.',
      });
    }
  };
}

export const taxController = new TaxController();


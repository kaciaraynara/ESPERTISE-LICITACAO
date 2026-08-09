import { Request, Response } from 'express';

interface MetricasCRM {
  totalPipeline: number;
  valorTotalEmDisputa: number;
  taxaConversao: number;
  sessoesHoje: number;
}

export class CrmController {

  async listarOportunidades(req: Request, res: Response) {
    try {
      const oportunidades = [
        {
          id: 'opp-01',
          numeroProcesso: 'PE nº 089/2024',
          orgaoComprador: 'Sec. Estadual de Saúde - SES/SP',
          uf: 'SP',
          valorEstimado: 2450000.00,
          valorPropostaEmpresa: 2210000.00,
          etapa: 'MAPPING',
          prioridade: 'ALTA',
          dataSessao: '2026-08-15T09:00:00',
          portal: 'PNCP',
          responsavel: 'Carlos Eduardo',
          margemEstimadaPercentual: 18.5
        }
      ];

      return res.json({ success: true, data: oportunidades });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao carregar funil CRM' });
    }
  }

  async atualizarEtapa(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { etapa } = req.body;

      return res.json({ 
        success: true, 
        message: `Oportunidade ${id} movida para a etapa ${etapa} com sucesso.` 
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao atualizar etapa' });
    }
  }

  async getMetricas(req: Request, res: Response) {
    try {
      const metricas: MetricasCRM = {
        totalPipeline: 5,
        valorTotalEmDisputa: 12240000.00,
        taxaConversao: 32.4,
        sessoesHoje: 1
      };

      return res.json({ success: true, data: metricas });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao carregar métricas do CRM' });
    }
  }
}
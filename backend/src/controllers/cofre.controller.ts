import { Request, Response } from 'express';

interface MetricasCofre {
  totalDocumentos: number;
  validos: number;
  prestesAVencer: number;
  vencidos: number;
}

export class CofreController {

  async listarDocumentos(req: Request, res: Response) {
    try {
      const documentos: any[] = [
        {
          id: 'doc-01',
          nome: 'Certidão Negativa de Débitos Federais (PGFN)',
          categoria: 'REGULARIDADE_FISCAL',
          orgaoEmissor: 'Receita Federal / PGFN',
          dataEmissao: '2026-03-01',
          dataValidade: '2026-08-28',
          diasParaVencer: 21,
          status: 'ALERTA_VENCIMENTO',
          versao: 'v2026.1',
          tamanhoArquivo: '240 KB',
          tag: 'Certidão Crítica',
          arquivoUrl: '/uploads/cnd-federal.pdf'
        }
      ];

      return res.json({ success: true, data: documentos });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao listar documentos do Cofre' });
    }
  }

  async getMetricas(req: Request, res: Response) {
    try {
      const metricas: MetricasCofre = {
        totalDocumentos: 24,
        validos: 22,
        prestesAVencer: 1,
        vencidos: 1
      };

      return res.json({ success: true, data: metricas });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao obter estatísticas do Cofre' });
    }
  }
}
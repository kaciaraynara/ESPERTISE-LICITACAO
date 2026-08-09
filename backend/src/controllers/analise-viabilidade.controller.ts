// 📁 backend/src/controllers/analise-viabilidade.controller.ts

import { Request, Response } from 'express';

// Local type definitions to avoid external missing module error
type ResumoItem = { titulo: string; status: string; riscosCount?: string };
type RadarItem = { eixo: string; nossoValor: number; concorrente1: number; concorrente2: number; concorrente3: number };
type ExigenciaItem = { id: string; categoria: string; status: string };

type AnaliseViabilidadeData = {
  editalNumero: string;
  score: { percentual: number; classificacao: string; descricao: string };
  resumo: ResumoItem[];
  precos: { nossoPreco: number; estimativaEdital: number; margemEstimadaPercent: number };
  radarConcorrencia: RadarItem[];
  exigencias: ExigenciaItem[];
};

export class AnaliseViabilidadeController {
  
  async getAnalisePorEdital(req: Request, res: Response) {
    try {
      const { editalId } = req.params;

      // Dados estruturados idênticos ao dashboard do marketing
      const responseData: AnaliseViabilidadeData = {
        editalNumero: editalId || 'Pregão 042/2024',
        score: {
          percentual: 85,
          classificacao: 'ALTA VIABILIDADE',
          descricao: 'Excelente oportunidade para participação'
        },
        resumo: [
          { titulo: 'Estudo de Preços', status: 'Concluído' },
          { titulo: 'Perfil da Concorrência', status: 'Concluído' },
          { titulo: 'Exigências do Edital', status: 'Concluído' },
          { titulo: 'Riscos Identificados', status: 'Concluído', riscosCount: '2 riscos baixos' }
        ],
        precos: {
          nossoPreco: 245000.00,
          estimativaEdital: 280000.00,
          margemEstimadaPercent: 12.5
        },
        radarConcorrencia: [
          { eixo: 'Preço', nossoValor: 85, concorrente1: 70, concorrente2: 60, concorrente3: 50 },
          { eixo: 'Qualidade Técnica', nossoValor: 90, concorrente1: 80, concorrente2: 75, concorrente3: 60 },
          { eixo: 'Capacidade', nossoValor: 80, concorrente1: 85, concorrente2: 70, concorrente3: 65 },
          { eixo: 'Histórico', nossoValor: 95, concorrente1: 60, concorrente2: 80, concorrente3: 70 },
          { eixo: 'Prazo', nossoValor: 85, concorrente1: 75, concorrente2: 65, concorrente3: 80 }
        ],
        exigencias: [
          { id: '1', categoria: 'Qualificação Técnica', status: 'Atendido' },
          { id: '2', categoria: 'Garantias', status: 'Atenção' },
          { id: '3', categoria: 'Qualificação Econômica', status: 'Atendido' },
          { id: '4', categoria: 'Visita Técnica', status: 'Não exigida' },
          { id: '5', categoria: 'Documentação', status: 'Atendido' },
          { id: '6', categoria: 'Amostras', status: 'Atenção' }
        ]
      };

      return res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar análise de viabilidade do edital'
      });
    }
  }
}
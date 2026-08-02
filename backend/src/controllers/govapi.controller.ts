import { Request, Response } from 'express';
import {
  SicafIntegrationError,
  avaliarRiscoIrregularidade,
  consultarSicaf,
  getLinkConsultaSicaf,
} from '../services/sicaf.service';
import { buscarHistoricoPregoes, calcularPrecoReferencia } from '../services/comprasgov.service';


function normalizeCnpj(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function respondSicafError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof SicafIntegrationError) {
    return res.status(error.statusCode).json({
      success: false,
      source: error.source,
      official: error.official,
      status: error.code.replace('SICAF_', ''),
      code: error.code,
      data: null,
      message: error.message,
    });
  }

  console.error(JSON.stringify({
    event: 'SICAF_UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
  }));

  return res.status(500).json({
    success: false,
    source: 'SICAF',
    official: true,
    status: 'UNEXPECTED_ERROR',
    code: 'SICAF_UNEXPECTED_ERROR',
    data: null,
    message: fallbackMessage,
  });
}

export class GovAPIController {

  /**
   * GET /gov/sicaf/:cnpj
   * Consulta a situação do fornecedor no SICAF
   */
  async consultarSicaf(req: Request, res: Response) {
    const { cnpj } = req.params;
    const cnpjLimpo = normalizeCnpj(cnpj);

    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ success: false, message: 'CNPJ inválido' });
    }

    try {
      const fornecedor = await consultarSicaf(cnpjLimpo);
      const risco = avaliarRiscoIrregularidade(fornecedor);
      const linkPortal = getLinkConsultaSicaf(cnpjLimpo);

      return res.json({
        success: true,
        data: {
          ...fornecedor,
          avaliacao_risco: risco,
          link_portal_sicaf: linkPortal,
        },
      });
    } catch (err) {
      return respondSicafError(
        res,
        err,
        'Erro inesperado ao consultar o SICAF.',
      );
    }
  }

  /**
   * GET /gov/comprasgov/historico
   * Busca histórico de preços de pregões passados
   * Query: ?descricao=software&uf=SP
   */
  async historicoPrecos(req: Request, res: Response) {
    const { descricao, uf, codigoCatmat, pagina } = req.query;

    try {
      const historico = await buscarHistoricoPregoes({
        descricao: descricao as string,
        uf: uf as string,
        codigoCatmat: codigoCatmat as string,
        pagina: pagina ? Number(pagina) : 1,
      });

      const preco = calcularPrecoReferencia(historico);

      return res.json({
        success: true,
        data: {
          historico,
          analise_preco: preco,
          total: historico.length,
          criterio_busca: { descricao, uf, codigoCatmat },
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar histórico de preços',
        error: (err as Error).message,
      });
    }
  }

  /**
   * GET /gov/certidoes/:cnpj
   * Lista todas as certidões da empresa com status e links de renovação
   */
  async listarCertidoes(req: Request, res: Response) {
    const { cnpj } = req.params;
    const cnpjLimpo = normalizeCnpj(cnpj);

    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ success: false, message: 'CNPJ inválido' });
    }

    try {
      const sicaf = await consultarSicaf(cnpjLimpo);
      const hoje = new Date();

      const certidoesEnriquecidas = sicaf.certidoes.map(cert => {
        const vencimento = new Date(cert.validade);
        const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000);

        return {
          ...cert,
          dias_restantes: diasRestantes,
          alerta: diasRestantes <= 7 ? 'CRÍTICO' : diasRestantes <= 15 ? 'URGENTE' : diasRestantes <= 30 ? 'ATENCAO' : 'OK',
        };
      });

      const resumo = {
        total: certidoesEnriquecidas.length,
        validas: certidoesEnriquecidas.filter(c => c.alerta === 'OK').length,
        atencao: certidoesEnriquecidas.filter(c => c.alerta === 'ATENCAO').length,
        urgente: certidoesEnriquecidas.filter(c => ['URGENTE', 'CRÍTICO'].includes(c.alerta)).length,
        vencidas: certidoesEnriquecidas.filter(c => c.status === 'vencida').length,
      };

      return res.json({
        success: true,
        data: {
          cnpj: cnpjLimpo,
          certidoes: certidoesEnriquecidas,
          resumo,
          prontidao_licitacao: resumo.vencidas === 0 && resumo.urgente === 0,
        },
      });
    } catch (err) {
      return respondSicafError(
        res,
        err,
        'Erro inesperado ao consultar as certidões.',
      );
    }
  }
}

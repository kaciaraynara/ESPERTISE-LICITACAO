import axios from 'axios';
import { Request, Response } from 'express';
import { consultarCnpjOficial, normalizarCnpj } from '../services/cnpj.service';
import { PncpService, PncpServiceError } from '../services/pncp.service';
import { DataPlatformIngestionService } from '../services/data-platform/ingestion.service';

export class IntegracoesController {
  async consultarCnpj(req: Request, res: Response) {
    const cnpjLimpo = normalizarCnpj(req.params.cnpj ?? '');

    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({
        success: false,
        code: 'CNPJ_INVALID',
        message: 'Informe um CNPJ válido com 14 dígitos.',
      });
    }

    try {
      return res.json({
        success: true,
        data: await consultarCnpjOficial(cnpjLimpo),
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return res.status(404).json({
            success: false,
            code: 'CNPJ_NOT_FOUND',
            message: 'CNPJ não encontrado na fonte oficial.',
          });
        }

        const timedOut = error.response?.status === 408
          || error.response?.status === 504
          || error.code === 'ECONNABORTED'
          || error.code === 'ETIMEDOUT';

        return res.status(timedOut ? 504 : 503).json({
          success: false,
          code: timedOut ? 'CNPJ_SERVICE_TIMEOUT' : 'CNPJ_SERVICE_UNAVAILABLE',
          message: timedOut
            ? 'A fonte oficial de CNPJ demorou para responder.'
            : 'A fonte oficial de CNPJ está temporariamente indisponível.',
        });
      }

      return res.status(503).json({
        success: false,
        code: 'CNPJ_SERVICE_UNAVAILABLE',
        message: 'Não foi possível consultar a fonte oficial de CNPJ.',
      });
    }
  }

  async sincronizarPncp(_req: Request, res: Response) {
    const hoje = new Date().toISOString().slice(0, 10);

    try {
      const ingestion = new DataPlatformIngestionService();
      const resultado = await ingestion.ingestPncp({
        since: hoje,
      });

      return res.json({
        success: true,
        data: resultado,
        meta: {
          fonte: 'PNCP',
          consultadoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof PncpServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      return res.status(503).json({
        success: false,
        code: 'PNCP_UNAVAILABLE',
        message: 'A fonte oficial do PNCP está temporariamente indisponível.',
      });
    }
  }
}

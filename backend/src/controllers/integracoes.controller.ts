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

      const inseridos = resultado.persisted.procurementNotices;
      const falhas = resultado.result.counters.failed;
      return res.json({
        success: falhas === 0,
        data: resultado,
        inseridos,
        persistidos: resultado.persisted.procurementNotices,
        duplicados: resultado.result.counters.duplicated,
        falhas,
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

  async catalogo(_req: Request, res: Response) {
    const fontes = [
      {
        id: 'pncp',
        nome: 'Portal Nacional de Contratações Públicas (PNCP)',
        orgao: 'Ministério da Gestão e da Inovação em Serviços Públicos',
        tipo: 'API REST Oficial',
        descricao: 'Base central obrigatória da Nova Lei de Licitações (Lei 14.133/2021) com editais, itens, atas de registro de preços e contratos de todas as esferas.',
        documentacaoUrl: 'https://pncp.gov.br/api/consulta/swagger-ui/index.html',
        integradoNoApp: true,
      },
      {
        id: 'comprasgov',
        nome: 'Compras.gov.br — Dados Abertos',
        orgao: 'Governo Federal (SIASG / Comprasnet)',
        tipo: 'API REST Oficial',
        descricao: 'Histórico de pregões eletrônicos, dispensas, catálogo CATMAT/CATSERV e preços praticados para formação de preço de referência.',
        documentacaoUrl: 'https://dadosabertos.compras.gov.br/swagger-ui/index.html',
        integradoNoApp: true,
      },
      {
        id: 'transparencia',
        nome: 'Portal da Transparência — CEIS / CNEP / CEPIM',
        orgao: 'Controladoria-Geral da União (CGU)',
        tipo: 'API REST Oficial',
        descricao: 'Consulta de sanções administrativas, inidoneidade, impedimentos de licitar e investigação de concorrentes em tempo real.',
        documentacaoUrl: 'https://api.portaldatransparencia.gov.br/swagger-ui.html',
        integradoNoApp: true,
      },
      {
        id: 'receita_cnpj',
        nome: 'Cadastro Nacional da Pessoa Jurídica (CNPJ)',
        orgao: 'Receita Federal / BrasilAPI',
        tipo: 'API REST Pública',
        descricao: 'Enriquecimento cadastral automático de empresas e concorrentes (CNAEs, quadro societário, porte, capital social e situação cadastral).',
        documentacaoUrl: 'https://brasilapi.com.br/docs#tag/CNPJ',
        integradoNoApp: true,
      },
    ];

    return res.json({
      success: true,
      data: fontes,
    });
  }

  async health(_req: Request, res: Response) {
    const checks = await Promise.all([
      this.probeUrl('PNCP', 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20250101&dataFinal=20250101&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=1'),
      this.probeUrl('COMPRAS.GOV', 'https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial?pagina=1&tamanhoPagina=1&codigoItemCatalogo=150515'),
      this.probeUrl('RECEITA / CNPJ', 'https://brasilapi.com.br/api/cnpj/v1/00000000000191'),
      this.probeTransparencia(),
    ]);

    return res.json({
      success: true,
      data: checks,
    });
  }

  private async probeUrl(id: string, url: string): Promise<{ id: string; ok: boolean; ms: number; mensagem: string }> {
    const start = Date.now();
    try {
      const response = await axios.get(url, {
        timeout: 6000,
        validateStatus: (status) => status >= 200 && status < 500,
      });
      const ms = Date.now() - start;
      const ok = response.status >= 200 && response.status < 400;
      return {
        id,
        ok,
        ms,
        mensagem: ok ? 'Operante' : `HTTP ${response.status}`,
      };
    } catch {
      return {
        id,
        ok: false,
        ms: Date.now() - start,
        mensagem: 'Indisponível / Timeout',
      };
    }
  }

  private async probeTransparencia(): Promise<{ id: string; ok: boolean; ms: number; mensagem: string }> {
    const start = Date.now();
    const token = process.env.PORTAL_TRANSPARENCIA_TOKEN || process.env.TRANSPARENCIA_API_KEY;
    if (!token) {
      return {
        id: 'TRANSPARÊNCIA (CGU)',
        ok: false,
        ms: 0,
        mensagem: 'Chave não configurada',
      };
    }

    try {
      const response = await axios.get('https://api.portaldatransparencia.gov.br/api-de-dados/ceis?pagina=1', {
        headers: { 'chave-api-dados': token },
        timeout: 6000,
        validateStatus: (status) => status >= 200 && status < 500,
      });
      const ok = response.status === 200;
      return {
        id: 'TRANSPARÊNCIA (CGU)',
        ok,
        ms: Date.now() - start,
        mensagem: ok ? 'Operante' : `HTTP ${response.status}`,
      };
    } catch {
      return {
        id: 'TRANSPARÊNCIA (CGU)',
        ok: false,
        ms: Date.now() - start,
        mensagem: 'Indisponível',
      };
    }
  }
}

import axios from 'axios';
import https from 'https';
import { Request, Response } from 'express';
import { consultarCnpjOficial, normalizarCnpj } from '../services/cnpj.service';
import { PncpServiceError } from '../services/pncp.service';
import { syncPncpPropostasAbertas, syncPncpAtualizacoes } from '../jobs/radar.cron';
import { syncComprasGovRecentes } from '../services/comprasgov.service';
import { syncQueridoDiarioEditais } from '../services/querido-diario.service';
import { prisma } from '../database/prisma';

const QD_HTTPS_AGENT = new https.Agent({ minVersion: 'TLSv1.2' });

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
    try {
      const runPncp = async () => {
        const prop = await syncPncpPropostasAbertas(3);
        const atu = await syncPncpAtualizacoes(2);
        return { prop, atu };
      };

      const [pncpRes, cgRes, qdRes] = await Promise.allSettled([
        runPncp(),
        syncComprasGovRecentes({ daysBack: 3, maxPages: 2 }),
        syncQueridoDiarioEditais({ daysBack: 7, size: 60, maxPages: 2 }),
      ]);

      const pncpVal =
        pncpRes.status === 'fulfilled'
          ? pncpRes.value
          : {
            prop: { totalEncontrados: 0, upsertados: 0, erros: 1, modalidadesProcessadas: 0 },
            atu: { totalEncontrados: 0, upsertados: 0 },
          };
      const cg = cgRes.status === 'fulfilled' ? cgRes.value : { fonte: 'ComprasGov', persisted: 0 };
      const qd = qdRes.status === 'fulfilled' ? qdRes.value : { fonte: 'querido_diario', persisted: 0 };

      const persistidos = pncpVal.prop.upsertados + pncpVal.atu.upsertados + cg.persisted + qd.persisted;
      const falhas = [pncpRes, cgRes, qdRes].filter((r) => r.status === 'rejected').length;

      return res.json({
        success: falhas < 3,
        data: {
          pncpPropostas: pncpVal.prop,
          pncpAtualizacoes: pncpVal.atu,
          comprasGov: cg,
          queridoDiario: qd,
        },
        inseridos: persistidos,
        persistidos,
        duplicados: 0,
        falhas,
        meta: {
          fonte: 'MULTIFONTE',
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
        id: 'querido_diario',
        nome: 'Querido Diário (OKBR)',
        orgao: 'Open Knowledge Brasil — Diários Oficiais Municipais',
        tipo: 'API REST Pública',
        descricao: 'Coleta diária de extratos e avisos de licitação publicados em Diários Oficiais municipais.',
        documentacaoUrl: 'https://queridodiario.ok.org.br/api/docs',
        integradoNoApp: true,
      },
      {
        id: 'transparencia',
        nome: 'Portal da Transparência — CEIS / CNEP / CEPIM e Contratos',
        orgao: 'Controladoria-Geral da União (CGU)',
        tipo: 'API REST Oficial',
        descricao: 'Consulta de sanções administrativas (CEIS, CNEP, CEPIM), contratos federais, impedimentos de licitar e dossiê de concorrentes. Editais vigentes são ingeridos via PNCP, Compras.gov.br e Diários Oficiais.',
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
    // As APIs públicas exigem tamanhoPagina >= 10 e janelas de data válidas.
    const hoje = new Date();
    const em30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
    const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const comprasGovBase = (process.env.COMPRASGOV_BASE_URL || 'https://dadosabertos.compras.gov.br').replace(/\/+$/, '');
    const qdBase = (process.env.QUERIDO_DIARIO_BASE_URL || 'https://queridodiario.ok.org.br/api').replace(/\/+$/, '');

    const checkQueridoDiario = async () => {
      const gazettesProbe = await this.probeUrl(
        'QUERIDO DIÁRIO',
        `${qdBase}/gazettes?published_since=${iso(seteDiasAtras)}&size=1`,
        { timeout: 10000, httpsAgent: QD_HTTPS_AGENT },
      );
      if (gazettesProbe.ok) return gazettesProbe;

      const citiesProbe = await this.probeUrl(
        'QUERIDO DIÁRIO',
        `${qdBase}/cities?levels=1`,
        { timeout: 6000, httpsAgent: QD_HTTPS_AGENT },
      );
      if (citiesProbe.ok) {
        return {
          id: 'QUERIDO DIÁRIO',
          ok: true,
          ms: citiesProbe.ms,
          mensagem: 'Operante (índice de diários com resposta lenta)',
        };
      }
      return gazettesProbe;
    };

    const checks = await Promise.all([
      this.probeUrl(
        'PNCP',
        `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${iso(em30Dias).replace(/-/g, '')}&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10`,
        { timeout: 10000 },
      ),
      this.probeUrl(
        'COMPRAS.GOV',
        `${comprasGovBase}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?pagina=1&tamanhoPagina=10&dataPublicacaoPncpInicial=${iso(ontem)}&dataPublicacaoPncpFinal=${iso(hoje)}&codigoModalidade=5&contratacaoExcluida=false`,
        { timeout: 10000 },
      ),
      checkQueridoDiario(),
      this.probeUrl('RECEITA / CNPJ', 'https://brasilapi.com.br/api/cnpj/v1/00000000000191', { timeout: 10000 }),
      this.probeTransparencia(),
    ]);

    return res.json({
      success: true,
      data: checks,
    });
  }

  async telemetria(_req: Request, res: Response) {
    try {
      let fontesRaw: any[] = [];
      let cursorsRaw: any[] = [];
      let jobsRaw: any[] = [];

      if (typeof (prisma as any)?.$queryRawUnsafe === 'function') {
        const [fRes, cRes, jRes] = await Promise.all([
          (prisma as any).$queryRawUnsafe(`
            SELECT
              source,
              count(*)::int AS total,
              count(*) FILTER (
                WHERE NOT (COALESCE(status, '') ~* '(suspens|revogad|anulad|cancelad|encerrad|desert|fracassad|homologad)')
                  AND (
                    closing_at > NOW()
                    OR (source = 'querido_diario' AND closing_at IS NULL AND published_at >= NOW() - INTERVAL '15 days')
                    OR (modality ILIKE '%Credenciamento%' AND closing_at IS NULL AND published_at >= NOW() - INTERVAL '60 days')
                  )
              )::int AS abertos,
              count(*) FILTER (WHERE published_at >= NOW() - INTERVAL '24 hours')::int AS novos_24h,
              max(published_at) AS ultima_publicacao,
              max(updated_at) AS ultima_atualizacao
            FROM procurement_notices
            GROUP BY source
            ORDER BY total DESC
          `).catch(() => []),
          (prisma as any).$queryRawUnsafe(`
            SELECT source, cursor_key, cursor_value, last_synced_at, updated_at
            FROM data_source_cursors
            ORDER BY updated_at DESC
            LIMIT 25
          `).catch(() => []),
          (prisma as any).$queryRawUnsafe(`
            SELECT id, source, connector, status, records_seen, records_accepted, records_duplicated, records_failed, error_message, started_at, finished_at
            FROM data_ingestion_jobs
            ORDER BY created_at DESC
            LIMIT 12
          `).catch(() => []),
        ]);
        fontesRaw = Array.isArray(fRes) ? fRes : [];
        cursorsRaw = Array.isArray(cRes) ? cRes : [];
        jobsRaw = Array.isArray(jRes) ? jRes : [];
      }

      const fontes = fontesRaw.map((row) => ({
        source: String(row.source || 'PNCP'),
        total: Number(row.total ?? 0),
        abertos: Number(row.abertos ?? 0),
        novos24h: Number(row.novos_24h ?? 0),
        ultimaPublicacao: row.ultima_publicacao ? new Date(row.ultima_publicacao).toISOString() : null,
        ultimaAtualizacao: row.ultima_atualizacao ? new Date(row.ultima_atualizacao).toISOString() : null,
      }));

      const totalEditais = fontes.reduce((acc, f) => acc + f.total, 0);
      const totalAbertos = fontes.reduce((acc, f) => acc + f.abertos, 0);
      const novos24h = fontes.reduce((acc, f) => acc + f.novos24h, 0);
      const ultimaSincronizacao = fontes.reduce<string | null>((latest, f) => {
        if (!f.ultimaAtualizacao) return latest;
        if (!latest || f.ultimaAtualizacao > latest) return f.ultimaAtualizacao;
        return latest;
      }, null);

      const cursores = cursorsRaw.map((c) => ({
        source: String(c.source || ''),
        cursorKey: String(c.cursor_key || ''),
        cursorValue: c.cursor_value && typeof c.cursor_value === 'object' ? c.cursor_value : null,
        lastSyncedAt: c.last_synced_at ? new Date(c.last_synced_at).toISOString() : null,
      }));

      const jobs = jobsRaw.map((j) => ({
        id: String(j.id || ''),
        source: String(j.source || ''),
        connector: String(j.connector || ''),
        status: String(j.status || 'completed'),
        recordsSeen: Number(j.records_seen ?? 0),
        recordsAccepted: Number(j.records_accepted ?? 0),
        recordsFailed: Number(j.records_failed ?? 0),
        errorMessage: j.error_message ? String(j.error_message) : null,
        finishedAt: j.finished_at ? new Date(j.finished_at).toISOString() : null,
      }));

      return res.json({
        success: true,
        data: {
          resumo: {
            totalEditais,
            totalAbertos,
            novos24h,
            ultimaSincronizacao,
          },
          fontes,
          cursores,
          jobs,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Não foi possível carregar a telemetria de ingestão.',
      });
    }
  }

  private async probeUrl(
    id: string,
    url: string,
    options: { timeout?: number; httpsAgent?: https.Agent } = {},
  ): Promise<{ id: string; ok: boolean; ms: number; mensagem: string }> {
    const start = Date.now();
    const timeout = options.timeout ?? 10000;
    try {
      const response = await axios.get(url, {
        timeout,
        httpsAgent: options.httpsAgent,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EXPERTISE-SaaS/1.0',
        },
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
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '');
      return {
        id,
        ok: false,
        ms: Date.now() - start,
        mensagem: isTimeout ? `Timeout (>${Math.round(timeout / 1000)}s)` : (err?.code || 'Indisponível'),
      };
    }
  }

  private async probeTransparencia(): Promise<{ id: string; ok: boolean; ms: number; mensagem: string }> {
    const start = Date.now();
    const rawToken =
      process.env.PORTAL_TRANSPARENCIA_TOKEN
      || process.env.PORTAL_TRANSPARENCIA_KEY
      || process.env.TRANSPARENCIA_API_KEY
      || process.env.TRANSPARENCIA_TOKEN
      || process.env.CGU_API_KEY
      || process.env.TRANSPARENCIA_API_TOKEN
      || '';
    const trimmed = rawToken.trim();
    const matchJson = trimmed.startsWith('[') || trimmed.startsWith('{')
      ? trimmed.match(/"value"\s*:\s*"([^"]+)"/i)
      : null;
    const token = matchJson?.[1]?.trim() || trimmed;

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

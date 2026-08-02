import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { normalizarCnpj } from '../services/cnpj.service';
import { ConcorrentesService } from '../services/concorrentes.service';
import { ReceitaFederalServiceError, ReceitaService } from '../services/receita.service';
import { analisarConluioSocietario } from '../utils/analiseFraude.util';

const concorrentes = new ConcorrentesService();
const receita = new ReceitaService();

const MAX_CNPJS_MALHA_FINA = 20;

const malhaFinaSchema = z.object({
  cnpjs: z.array(z.string()).optional(),
  concorrentes: z.array(z.string()).optional(),
  licitacaoId: z.string().trim().min(1).optional(),
})
  .refine((data) => (data.cnpjs ?? data.concorrentes ?? []).length >= 2, {
    message: 'Informe ao menos dois CNPJs concorrentes para investigar a malha societária.',
    path: ['cnpjs'],
  })
  .refine((data) => (data.cnpjs ?? data.concorrentes ?? []).length <= MAX_CNPJS_MALHA_FINA, {
    message: `A investigação aceita no máximo ${MAX_CNPJS_MALHA_FINA} CNPJs por requisição.`,
    path: ['cnpjs'],
  });

export class ConcorrentesController {
  async malhaFina(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = malhaFinaSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para investigação de concorrentes.',
        errors: parsed.error.errors,
      });
    }

    const cnpjs = Array.from(new Set((parsed.data.cnpjs ?? parsed.data.concorrentes ?? []).map(normalizarCnpj)));

    if (cnpjs.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'A investigação exige ao menos dois CNPJs distintos.',
      });
    }

    if (cnpjs.length > MAX_CNPJS_MALHA_FINA) {
      return res.status(400).json({
        success: false,
        message: `A investigação aceita no máximo ${MAX_CNPJS_MALHA_FINA} CNPJs distintos.`,
      });
    }

    try {
      const resultadoConsultas = await receita.consultarQsaEmLoteDetalhado(cnpjs);
      const analise = analisarConluioSocietario(resultadoConsultas.empresas);

      const statusAnalise = resultadoConsultas.conclusiva
        ? 'CONCLUSIVA'
        : 'INCONCLUSIVA';

      const riscoExibido =
        !resultadoConsultas.conclusiva && analise.risco === 'BAIXO'
          ? 'MEDIO'
          : analise.risco;

      const recomendacoes = [...analise.recomendacoes];

      if (!resultadoConsultas.conclusiva) {
        recomendacoes.unshift(
          'A investigação é inconclusiva porque uma ou mais consultas à fonte pública não foram concluídas.',
          'Não interprete a ausência de vínculo nas empresas consultadas como prova de inexistência de vínculo entre todas as concorrentes.',
        );
      }

      return res.json({
        success: true,
        data: {
          titulo: 'Malha Fina da Licitação',
          licitacaoId: parsed.data.licitacaoId ?? null,
          fonte: 'brasilapi-cnpj',
          statusAnalise,
          conclusiva: resultadoConsultas.conclusiva,
          risco: riscoExibido,
          possuiSociosEmComum: analise.possuiSociosEmComum,
          resumo: {
            ...analise.resumo,
            totalSolicitado: resultadoConsultas.totalSolicitado,
            totalConsultasComSucesso: resultadoConsultas.totalSucesso,
            totalConsultasComFalha: resultadoConsultas.totalFalhas,
          },
          empresas: analise.empresas,
          vinculosSocietarios: analise.vinculosSocietarios,
          recomendacoes,
          consultas: resultadoConsultas.empresas.map((empresa) => ({
            cnpj: empresa.cnpj,
            razaoSocial: empresa.razaoSocial,
            fonte: empresa.fonte,
            totalSocios: empresa.qsa.length,
            consultadoEm: empresa.consultadoEm,
            status: 'SUCESSO',
          })),
          consultasComFalha: resultadoConsultas.falhas.map((falha) => ({
            cnpj: falha.cnpj,
            status: 'FALHA',
            code: falha.code,
            message: falha.message,
            statusCode: falha.statusCode,
            providerStatusCode: falha.providerStatusCode ?? null,
          })),
          geradoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ReceitaFederalServiceError) {
        console.warn(JSON.stringify({
          event: 'MALHA_FINA_RECEITA_FAILED',
          code: error.code,
          statusCode: error.statusCode,
          providerStatusCode: error.providerStatusCode,
          error: error.message,
          timestamp: new Date().toISOString(),
        }));

        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
          providerStatusCode: error.providerStatusCode,
        });
      }

      console.error(JSON.stringify({
        event: 'MALHA_FINA_FAILED',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      }));

      return res.status(500).json({
        success: false,
        message: 'Erro ao executar investigação societária dos concorrentes.',
      });
    }
  }

  async dossie(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    try {
      const data = await concorrentes.gerarDossie(req.params.cnpj, userId);
      const pncpFalhou = data.fontes.some((fonte) => fonte.fonte === 'pncp' && fonte.status === 'failed');
      const todasFontesFalharam = data.fontes.every((fonte) => fonte.status === 'failed');

      if (pncpFalhou || todasFontesFalharam) {
        return res.status(502).json({
          success: false,
          message: 'Não foi possível consultar o PNCP no momento. A base pública pode estar indisponível ou ter excedido o tempo limite.',
          data,
        });
      }

      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CNPJ') {
        return res.status(400).json({
          success: false,
          message: 'CNPJ inválido. Informe um CNPJ com 14 dígitos.',
        });
      }

      console.error(JSON.stringify({
        event: 'CONCORRENTE_DOSSIE_FAILED',
        cnpj: req.params.cnpj,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      }));

      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar dossiê de concorrente.',
      });
    }
  }
}

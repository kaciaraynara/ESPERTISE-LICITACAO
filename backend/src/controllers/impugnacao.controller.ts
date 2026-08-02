import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { gerarEsqueletoImpugnacao } from '../services/impugnacao.service';
import { NoticesErrorRadarService } from '../services/notices-error-radar.service';
import { calcularPrazoDecadencialImpugnacao } from '../utils/prazos.util';

const prazoSchema = z.object({
  data_certame: z.string().trim().min(1, 'Data do certame obrigatória'),
});

const pecaSchema = z.object({
  notice_id: z.string().trim().optional(),
  edital_id: z.string().trim().optional(),
  orgao: z.string().trim().optional(),
  setor_responsavel: z.string().trim().optional(),
  modalidade: z.string().trim().optional(),
  numero_pregao: z.string().trim().optional(),
  numero_edital: z.string().trim().optional(),
  processo_administrativo: z.string().trim().optional(),
  objeto: z.string().trim().optional(),
  criterio_julgamento: z.string().trim().optional(),
  plataforma: z.string().trim().optional(),
  data_certame: z.string().trim().min(1, 'Data do certame obrigatória'),
  nome_empresa: z.string().trim().optional(),
  cnpj_empresa: z.string().trim().optional(),
  representante_legal: z.string().trim().optional(),
  pontos_impugnacao: z.union([z.array(z.string()), z.string()]).optional(),
  dadosFraude: z.object({
    risco: z.enum(['ALTO', 'MEDIO', 'BAIXO']),
    possuiSociosEmComum: z.boolean().optional(),
    resumo: z.object({
      totalConcorrentes: z.number().optional(),
      totalVinculosSocietarios: z.number().optional(),
    }).optional(),
    vinculosSocietarios: z.array(z.object({
      socio: z.object({
        nome: z.string().trim().min(1),
        documentoMascarado: z.string().nullable().optional(),
      }),
      empresas: z.array(z.object({
        cnpj: z.string().trim().min(1),
        razaoSocial: z.string().trim().optional(),
        qualificacao: z.string().nullable().optional(),
        dataEntradaSociedade: z.string().nullable().optional(),
      })).min(2),
      totalEmpresas: z.number().optional(),
    })).optional(),
  }).optional(),
  formato: z.enum(['markdown', 'html']).optional(),
});

export class ImpugnacaoController {
  constructor(private readonly errorRadar = new NoticesErrorRadarService()) {}

  calcularPrazo(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = prazoSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para cálculo do prazo decadencial',
        errors: parsed.error.errors,
      });
    }

    try {
      const data = calcularPrazoDecadencialImpugnacao(parsed.data.data_certame);
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CERTAME_DATE') {
        return res.status(400).json({ success: false, message: 'Data do certame inválida' });
      }

      if (error instanceof Error && error.message === 'NOTICE_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado para gerar pontos de impugnacao' });
      }

      throw error;
    }
  }

  async gerarPeca(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = pecaSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para geração da peça de impugnação',
        errors: parsed.error.errors,
      });
    }

    const body = parsed.data;

    try {
      const pontosInformados = Array.isArray(body.pontos_impugnacao)
        ? body.pontos_impugnacao
        : typeof body.pontos_impugnacao === 'string'
          ? body.pontos_impugnacao.split('\n').map((item) => item.trim()).filter(Boolean)
          : [];

      const noticeId = body.notice_id || body.edital_id;
      const pontosRadar = noticeId
        ? await this.getPontosImpugnacaoFromRadar(noticeId, req)
        : [];

      const pontosImpugnacao = mergePontosImpugnacao(pontosInformados, pontosRadar);

      const data = gerarEsqueletoImpugnacao({
        orgao: body.orgao,
        setorResponsavel: body.setor_responsavel,
        modalidade: body.modalidade,
        numeroPregao: body.numero_pregao,
        numeroEdital: body.numero_edital,
        processoAdministrativo: body.processo_administrativo,
        objeto: body.objeto,
        criterioJulgamento: body.criterio_julgamento,
        plataforma: body.plataforma,
        dataCertame: body.data_certame,
        nomeEmpresa: body.nome_empresa,
        cnpjEmpresa: body.cnpj_empresa,
        representanteLegal: body.representante_legal,
        pontosImpugnacao,
        dadosFraude: body.dadosFraude,
        formato: body.formato,
      });

      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CERTAME_DATE') {
        return res.status(400).json({ success: false, message: 'Data do certame inválida' });
      }

      throw error;
    }
  }
  private async getPontosImpugnacaoFromRadar(noticeId: string, req: AuthRequest) {
    const radar = await this.errorRadar.analyzeNotice(noticeId, buildImpugnacaoContext(req));

    if (!radar) {
      throw new Error('NOTICE_NOT_FOUND');
    }

    return radar.issues.map((issue) => {
      const evidence = issue.evidence?.[0] ? ` Evidência localizada: ${issue.evidence[0]}` : '';
      return `${issue.title}. ${issue.description}${evidence} Recomendação: ${issue.recommendation}`;
    });
  }

}


function mergePontosImpugnacao(pontosInformados: string[], pontosRadar: string[]) {
  const merged = [...pontosInformados, ...pontosRadar]
    .map((ponto) => ponto.trim())
    .filter(Boolean);

  return Array.from(new Set(merged));
}

function buildImpugnacaoContext(req: AuthRequest) {
  return {
    tenantId: req.user?.tenantId ?? null,
    user: {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      isAdmin: Boolean(req.user?.isAdmin),
      permissions: req.user?.permissions ?? [],
    },
    requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  };
}

function clientIp(req: AuthRequest) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}


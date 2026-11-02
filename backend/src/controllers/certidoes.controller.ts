import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import {
  CertidaoArquivoIndisponivelError,
  certidoesService,
} from '../services/certidoes.service';
import { InfoSimplesError, infosimplesService } from '../services/infosimples.service';
import { prisma } from '../database/prisma';

export class CertidoesController {
  async forceSync(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    if (!infosimplesService.isConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'INFOSIMPLES_TOKEN_NOT_CONFIGURED',
        message: 'Integração pendente: API Key da Infosimples não configurada.',
      });
    }

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        code: 'COMPANY_NOT_SELECTED',
        message: 'Selecione uma empresa para sincronizar as certidões.',
      });
    }

    try {
      const company = await prisma.company.findFirst({
        where: {
          id: req.companyId,
          userId,
          tenantId: req.user?.tenantId,
        },
        select: { id: true, cnpj: true },
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          code: 'COMPANY_NOT_FOUND',
          message: 'A empresa selecionada não foi encontrada.',
        });
      }

      const data = await infosimplesService.sincronizarCertidoes(company.id, company.cnpj);
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof InfoSimplesError) {
        return res.status(error.httpStatus || 502).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      console.error('[CertidoesController] Falha ao sincronizar com a InfoSimples:', error);
      return res.status(500).json({
        success: false,
        code: 'CERTIFICATES_SYNC_FAILED',
        message: 'Não foi possível sincronizar as certidões. Tente novamente mais tarde.',
      });
    }
  }

  async listar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
      }

      const companyId = (req.query.empresa_id as string) || req.companyId;
      const certidoes = await certidoesService.listarCertidoes(userId, companyId);

      return res.json({
        success: true,
        data: certidoes,
      });
    } catch (error) {
      console.error('[CertidoesController] Erro ao listar:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar certidões do licitante.' });
    }
  }

  async download(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
      }

      const certidaoId = req.params.id;
      const companyId = (req.query.empresa_id as string) || req.companyId;

      const resultado = await certidoesService.obterArquivoCertidao(certidaoId, userId, companyId);

      // Se for presigned URL (S3 / Cloudflare R2)
      if (resultado.redirectUrl) {
        return res.redirect(resultado.redirectUrl);
      }

      // Arquivo salvo no storage local ou remoto.
      res.setHeader('Content-Type', resultado.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${resultado.fileName}"`);
      return res.send(resultado.buffer);
    } catch (error) {
      if (error instanceof CertidaoArquivoIndisponivelError) {
        return res.status(404).json({
          success: false,
          code: 'CERTIDAO_ARQUIVO_INDISPONIVEL',
          message: error.message,
        });
      }

      console.error('[CertidoesController] Erro no download da certidão:', error);
      return res.status(500).json({
        success: false,
        message: 'Falha ao processar download do documento da certidão.',
      });
    }
  }
}

export const certidoesController = new CertidoesController();

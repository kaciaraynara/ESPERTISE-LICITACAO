import { Request, Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { documentGenerationService } from '../services/document-generation.service';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

export class DocumentTemplatesController {
  async listar(req: AuthRequest, res: Response) {
    try {
      const templates = await prisma.documentTemplate.findMany({
        where: { active: true, OR: [{ tenantId: null }, { tenantId: req.user?.tenantId }] },
        orderBy: { title: 'asc' },
      });
      return res.json({ success: true, data: templates });
    } catch (error) {
      console.error('[DocumentTemplates] Erro ao listar templates:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar templates' });
    }
  }

  async gerar(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { format, mergeData } = req.body;

      if (!id) {
         return res.status(400).json({ success: false, message: 'ID do template é obrigatório' });
      }
      if (format !== 'pdf' && format !== 'docx') {
         return res.status(400).json({ success: false, message: 'Formato inválido. Use pdf ou docx' });
      }

      const { buffer, mimeType, filename } = await documentGenerationService.generateDocument({
        templateId: id,
        format,
        mergeData: mergeData || {},
        tenantId: req.user?.tenantId,
      });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error: any) {
      console.error('[DocumentTemplates] Erro ao gerar documento:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao gerar documento' });
    }
  }
}

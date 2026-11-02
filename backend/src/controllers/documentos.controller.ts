import { RequestHandler, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { documentoSchema } from '../shared/validations';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { documentosService } from '../services/documentos.service';

const allowedMimeTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function stripKnownExtension(fileName: string) {
  return fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
}

function isStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /^(SUPABASE_|DOCUMENTO_STORAGE_)/.test(message);
}

const documentosUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.DOCUMENTOS_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('DOCUMENTO_TIPO_INVALIDO'));
      return;
    }
    callback(null, true);
  },
}).single('arquivo');

export const documentosUpload: RequestHandler = (req, res, next) => {
  documentosUploadParser(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, message: 'Arquivo acima do tamanho máximo permitido.' });
      return;
    }
    if (err instanceof Error && err.message === 'DOCUMENTO_TIPO_INVALIDO') {
      res.status(400).json({ success: false, message: 'Tipo de arquivo inválido. Envie PDF, PNG ou JPG.' });
      return;
    }
    next(err);
  });
};

export class DocumentosController {
  async storageStatus(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }
    return res.json({ success: true, data: { available: true, provider: 'cloud-storage' } });
  }

  async download(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

      const { prisma } = await import('../database/prisma');
      const tenantId = req.user?.tenantId;
      const doc = await prisma.document.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId },
            ...(tenantId ? [{ company: { tenantId } }] : []),
          ],
        },
        select: { id: true, storageKey: true, url: true, fileMimeType: true, arquivoNome: true },
      });

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado' });
      }

      if (doc.storageKey) {
        const { storageService } = await import('../services/storage.service');
        const downloadUrl = await storageService.getPresignedDownloadUrl(doc.storageKey);

        // Se for URL externa do S3, redireciona diretamente com presigned URL
        if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
          return res.redirect(downloadUrl);
        }

        // Modo local fallback
        const fileContent = await storageService.getFileBuffer(doc.storageKey);
        res.setHeader('Content-Type', doc.fileMimeType || fileContent.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${doc.arquivoNome || 'documento'}"`);
        return res.send(fileContent.buffer);
      }

      if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
        return res.redirect(doc.url);
      }

      return res.status(404).json({ success: false, message: 'Arquivo não localizado no armazenamento' });
    } catch (error) {
      console.error('[Documentos] Erro no download:', error);
      return res.status(500).json({ success: false, message: 'Erro ao baixar arquivo' });
    }
  }

  async downloadLocal(req: AuthRequest, res: Response) {
    try {
      const storageKey = req.params[0] || (req.params as any).storageKey;
      if (!storageKey) {
        return res.status(400).json({ success: false, message: 'Chave de armazenamento não informada' });
      }

      const { storageService } = await import('../services/storage.service');
      const decodedKey = decodeURIComponent(storageKey);
      const fileContent = await storageService.getFileBuffer(decodedKey);
      const fileName = path.basename(decodedKey);

      res.setHeader('Content-Type', fileContent.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(fileContent.buffer);
    } catch (error) {
      console.error('[Documentos] Erro no download local:', error);
      return res.status(404).json({ success: false, message: 'Arquivo não localizado no armazenamento local' });
    }
  }

  async listar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

      const empresaId = typeof req.query.empresa_id === 'string' ? req.query.empresa_id : undefined;
      const data = await documentosService.listar(userId, empresaId);

      return res.json({ success: true, data });
    } catch (err: any) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      if (isStorageError(err)) {
        return res.status(503).json({
          success: false,
          code: 'DOCUMENT_STORAGE_UNAVAILABLE',
          message: 'O armazenamento de documentos está temporariamente indisponível.',
        });
      }
      console.error('[Documentos] Erro ao listar:', err);
      return res.status(500).json({ success: false, message: 'Erro ao listar documentos' });
    }
  }

  async criar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

      const file = req.file;
      const body = req.body as Record<string, string | undefined>;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Selecione um arquivo PDF, PNG ou JPG para cadastrar o documento.',
        });
      }
      
      const validatedData = documentoSchema.parse({
        ...body,
        nome: body.nome || (file ? stripKnownExtension(file.originalname) : body.nome),
        arquivo_nome: file?.originalname || body.arquivo_nome,
      });

      const data = await documentosService.criar(userId, validatedData, file);

      return res.status(201).json({
        success: true,
        data,
        message: 'Documento enviado ao armazenamento seguro.',
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, message: 'Dados inválidos', errors: err.errors });
      }
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      if (isStorageError(err)) {
        return res.status(503).json({
          success: false,
          code: 'DOCUMENT_STORAGE_UNAVAILABLE',
          message: 'O armazenamento de documentos está temporariamente indisponível.',
        });
      }
      console.error('[Documentos] Erro ao salvar:', err);
      return res.status(500).json({ success: false, message: 'Erro ao salvar documento' });
    }
  }

  async expedir(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    return res.status(501).json({
      success: false,
      code: 'DOCUMENT_EXPEDITION_NOT_IMPLEMENTED',
      message: 'O envio de documentos para portais externos ainda não está disponível.',
    });
  }

  async remover(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

      await documentosService.remover(userId, req.params.id);

      return res.json({ success: true, message: 'Documento removido do cofre' });
    } catch (err: any) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      if (isStorageError(err)) {
        return res.status(503).json({
          success: false,
          code: 'DOCUMENT_STORAGE_UNAVAILABLE',
          message: 'O armazenamento de documentos está temporariamente indisponível.',
        });
      }
      console.error('[Documentos] Erro ao remover:', err);
      return res.status(500).json({ success: false, message: 'Erro ao remover documento' });
    }
  }
}



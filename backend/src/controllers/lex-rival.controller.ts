import { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { analisarRecursoConcorrente } from '../services/lex-rival-analysis.service';

const uploadParser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // Limite seguro de 15MB para peças recursais
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('FORMATO_INVALIDO_PDF'));
      return;
    }
    callback(null, true);
  },
}).single('file');

/**
 * Middleware para upload do PDF de recurso
 */
export const uploadRecursoPdfMiddleware: RequestHandler = (req, res, next) => {
  uploadParser(req, res, (err: any) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo PDF excede o tamanho máximo permitido de 15MB.',
      });
    }

    if (err instanceof Error && err.message === 'FORMATO_INVALIDO_PDF') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_FILE_TYPE',
        message: 'Formato inválido. Apenas documentos no formato PDF são aceitos para análise.',
      });
    }

    return res.status(400).json({
      success: false,
      code: 'UPLOAD_ERROR',
      message: 'Falha ao processar o upload do arquivo PDF.',
    });
  });
};

/**
 * Controlador de Análise de Recurso do Concorrente (Contencioso Lex)
 */
export class LexRivalController {
  public analyzeRival = async (req: Request, res: Response): Promise<Response> => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          code: 'NO_FILE_PROVIDED',
          message: 'Nenhum documento PDF foi enviado. Por favor, anexe o recurso do concorrente.',
        });
      }

      const { pregaoNumero, nomeNossaEmpresa, objetoLicitacao } = req.body;

      const result = await analisarRecursoConcorrente({
        pdfBuffer: req.file.buffer,
        nomeArquivo: req.file.originalname,
        pregaoNumero: pregaoNumero ? String(pregaoNumero).trim() : undefined,
        nomeNossaEmpresa: nomeNossaEmpresa ? String(nomeNossaEmpresa).trim() : undefined,
        objetoLicitacao: objetoLicitacao ? String(objetoLicitacao).trim() : undefined,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[LexRivalController] Erro na análise do recurso:', error);

      const errorMessage = error?.message || '';

      if (errorMessage.includes('PDF_CORROMPIDO') || errorMessage.includes('PDF_SEM_TEXTO')) {
        return res.status(422).json({
          success: false,
          code: 'UNPROCESSABLE_PDF',
          message: errorMessage.replace(/^[^:]+:\s*/, ''),
        });
      }

      if (errorMessage.includes('TIMEOUT_OPENAI')) {
        return res.status(504).json({
          success: false,
          code: 'GATEWAY_TIMEOUT',
          message: 'A inteligência jurídica demorou além do esperado para responder. Tente novamente em instantes.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'LEX_ANALYSIS_FAILED',
        message: 'Ocorreu uma instabilidade ao gerar a defesa contra o recurso. Tente novamente.',
      });
    }
  };
}

export const lexRivalController = new LexRivalController();


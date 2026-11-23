import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { habilitacaoService } from '../services/habilitacao.service';

export class HabilitacaoController {
  /**
   * Consulta os 13 documentos de habilitação e suas situações
   */
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
      }

      const companyId = (req.query.empresa_id as string) || req.companyId;
      const data = await habilitacaoService.obterStatusDocumentos(userId, companyId);
      return res.json({ success: true, data });
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível carregar a lista de documentos.';
      return res.status(err?.message?.startsWith('EMPRESA_NAO_ENCONTRADA') ? 404 : 500).json({
        success: false,
        message: msg,
      });
    }
  }

  /**
   * Dispara a emissão silenciosa e protegida dos documentos gratuitos
   */
  async emitirGratuitos(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
      }

      const companyId = (req.body?.empresa_id as string) || (req.query.empresa_id as string) || req.companyId;
      const data = await habilitacaoService.emitirDocumentosGratuitos(userId, companyId);
      return res.json({
        success: true,
        message: 'Documentos gratuitos emitidos com sucesso e salvos na sua pasta.',
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'O portal do governo está instável no momento. Você pode abrir o site oficial pelo botão ao lado e anexar o arquivo manualmente.',
      });
    }
  }

  /**
   * Salva um documento anexado pelo usuário para um dos 13 itens da Lei 14.133/2021
   */
  async anexarDocumento(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'Selecione um arquivo para enviar.' });
      }

      const companyId = (req.body?.empresa_id as string) || req.companyId;
      const codigoItem = Number(req.body?.codigoItem || req.body?.codigo);
      if (!codigoItem || codigoItem < 1 || codigoItem > 13) {
        return res.status(400).json({ success: false, message: 'Código de documento inválido (escolha de 1 a 13).' });
      }

      const dataVencimento = req.body?.dataVencimento || req.body?.validade || null;
      const data = await habilitacaoService.anexarDocumentoItem(userId, companyId || undefined, codigoItem, file, dataVencimento);

      return res.json({
        success: true,
        message: 'Documento anexado com sucesso na pasta da sua empresa.',
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Não foi possível anexar o arquivo agora. Tente novamente.',
      });
    }
  }

  /**
   * Baixa a pasta completa organizada em formato compactado com numeração oficial
   */
  async baixarPastaCompleta(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
      }

      const companyId = (req.query.empresa_id as string) || req.companyId;
      const { buffer, nomeArquivo } = await habilitacaoService.gerarPastaCompletaCompactada(userId, companyId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('NENHUM_DOCUMENTO_PRONTO')) {
        return res.status(400).json({
          success: false,
          message: 'Anexe ou emita pelo menos um documento antes de baixar a pasta completa.',
        });
      }
      return res.status(500).json({
        success: false,
        message: msg || 'Não foi possível gerar a pasta compactada no momento.',
      });
    }
  }
}

export const habilitacaoController = new HabilitacaoController();

import { Request, Response } from 'express';
import { LicitacaoSearchService } from '../services/licitacao-search.service';
import { buscarHistoricoPregoes, calcularPrecoReferencia } from '../services/comprasgov.service';
import { checarSancoesCnpj } from '../services/transparencia.service';

const searchService = new LicitacaoSearchService();

export class LicitacaoController {
  public async buscar(req: Request, res: Response): Promise<Response> {
    try {
      const {
        q,
        uf,
        valorMin,
        valorMax,
        modalidade,
        dataInicio,
        dataFim,
        pagina,
        tamanhoPagina,
        fonte,
      } = req.query;

      const resultado = await searchService.execute({
        descricao: q ? String(q) : undefined,
        uf: uf ? String(uf) : undefined,
        valorMin: valorMin ? Number(valorMin) : undefined,
        valorMax: valorMax ? Number(valorMax) : undefined,
        modalidade: modalidade ? String(modalidade) : undefined,
        dataInicio: dataInicio ? String(dataInicio) : undefined,
        dataFim: dataFim ? String(dataFim) : undefined,
        pagina: pagina ? Number(pagina) : 1,
        tamanhoPagina: tamanhoPagina ? Number(tamanhoPagina) : 20,
        fonte: (fonte as any) || 'TODAS',
      });

      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Erro interno ao processar a busca de licitações.',
      });
    }
  }

  public async precoReferencia(req: Request, res: Response): Promise<Response> {
    try {
      const { descricao, catmat, uf } = req.query;

      if (!descricao && !catmat) {
        return res.status(400).json({
          message: 'É necessário informar ao menos a descrição ou o código CATMAT.',
        });
      }

      const historico = await buscarHistoricoPregoes({
        descricao: descricao ? String(descricao) : undefined,
        codigoCatmat: catmat ? String(catmat) : undefined,
        uf: uf ? String(uf) : undefined,
      });

      const analise = calcularPrecoReferencia(historico);

      return res.status(200).json({
        totalAmostras: historico.length,
        analise,
        amostras: historico.slice(0, 10), // Retorna até 10 amostras recentes
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao calcular preço de referência.' });
    }
  }

  public async checarRiscoFornecedor(req: Request, res: Response): Promise<Response> {
    try {
      const { cnpj } = req.params;

      if (!cnpj) {
        return res.status(400).json({ message: 'CNPJ do fornecedor é obrigatório.' });
      }

      const analiseRisco = await checarSancoesCnpj(cnpj);

      return res.status(200).json(analiseRisco);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        message: error.message || 'Erro ao checar sanções do fornecedor.',
      });
    }
  }
}
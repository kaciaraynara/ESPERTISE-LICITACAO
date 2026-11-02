import { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { calcularViabilidade, calcularViabilidadeAutentica } from '../services/viabilidade.service';
import { buscarLicitacaoPorIdOuControle } from '../services/licitacoes.service';

type ResumoItem = { titulo: string; status: string; riscosCount?: string; detalhe?: string };
type ExigenciaItem = { id: string; categoria: string; status: string; detalhe?: string };

type AnaliseViabilidadeData = {
  editalId: string;
  editalNumero: string;
  orgao: string;
  objeto: string;
  uf?: string | null;
  municipio?: string | null;
  modalidade?: string | null;
  dataAbertura?: string | null;
  score: {
    percentual: number;
    classificacao: 'VIÁVEL (ALTA VIABILIDADE)' | 'MARGEM APERTADA' | 'INVIÁVEL' | 'SEM VALOR ESTIMADO';
    descricao: string;
  };
  resumo: ResumoItem[];
  precos: {
    nossoPreco: number;
    estimativaEdital: number;
    precoMinimoSustentavel: number;
    custoProduto: number;
    custoLogistico: number;
    impostosValor: number;
    taxasAdministrativas: number;
    margemEstimadaPercent: number;
    margemEstimadaValor: number;
  };
  viabilidadeDetalhada: ReturnType<typeof calcularViabilidade> | null;
  exigencias: ExigenciaItem[];
  lex?: {
    parecerExequibilidade?: string;
    recomendacaoEstrategica?: string;
    alertas: Array<{
      risco: 'Alto' | 'Médio' | 'Atenção' | 'Baixo' | string;
      titulo: string;
      mensagem: string;
    }>;
  };
  lexAnalysis?: {
    parecerExequibilidade?: string;
    alertasRiscos?: string[];
    recomendacaoEstrategica?: string;
  };
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class AnaliseViabilidadeController {
  async getAnalisePorEdital(req: Request, res: Response) {
    try {
      const { editalId } = req.params;
      const query = { ...(req.query || {}), ...(req.body || {}) } as Record<string, any>;
      const targetParam = editalId || query.id || query.edital;

      let notice = null;

      if (targetParam && targetParam !== 'undefined' && targetParam !== 'null') {
        const cleanId = String(targetParam).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        const whereConditions: any[] = [
          { externalId: cleanId },
          { numeroControlePncp: cleanId },
          { noticeNumber: cleanId },
          { dedupeKey: `pncp-${cleanId}` },
          { dedupeKey: cleanId },
        ];
        if (isUuid) {
          whereConditions.unshift({ id: cleanId });
        }

        notice = await prisma.procurementNotice.findFirst({
          where: { OR: whereConditions },
        });

        // Se ainda não estiver no banco local, busca na fonte oficial e persiste
        if (!notice) {
          try {
            const fetched = await buscarLicitacaoPorIdOuControle(cleanId, { requirePersistence: true });
            const targetNoticeId = fetched?.databaseId || fetched?.id;
            if (targetNoticeId) {
              notice = await prisma.procurementNotice.findFirst({
                where: {
                  OR: [
                    { id: targetNoticeId },
                    { externalId: fetched.numeroControlePNCP },
                    { dedupeKey: `pncp-${fetched.numeroControlePNCP}` },
                  ],
                },
              });
            }
          } catch (syncErr) {
            console.warn('[AnaliseViabilidadeController] Aviso ao buscar edital remoto:', syncErr);
          }
        }
      }

      // Se nenhum edital específico foi requisitado, busca o edital ativo mais recente com valor estimado
      if (!notice) {
        notice = await prisma.procurementNotice.findFirst({
          where: {
            estimatedValue: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!notice) {
        return res.status(404).json({
          success: false,
          code: 'NOTICE_NOT_FOUND',
          message: 'Nenhum edital localizado para análise de viabilidade.',
        });
      }

      const estimativaEdital = Number(notice.estimatedValue) || 0;

      if (estimativaEdital <= 0) {
        const responseData: AnaliseViabilidadeData = {
          editalId: notice.id,
          editalNumero: notice.noticeNumber || notice.externalId || 'Edital sem número',
          orgao: notice.buyerName || 'Órgão Licitante',
          objeto: notice.object || 'Objeto não informado no edital oficial',
          uf: notice.uf,
          municipio: notice.municipality,
          modalidade: notice.modality,
          dataAbertura: notice.openingAt?.toISOString() || null,
          score: {
            percentual: 40,
            classificacao: 'SEM VALOR ESTIMADO',
            descricao: 'O edital oficial não divulgou o valor estimado ou orçamento de referência. Necessário cotar itens unitários.',
          },
          resumo: [
            { titulo: 'Estudo de Preços', status: 'Requer Cotação', detalhe: 'Valor de referência não divulgado' },
            { titulo: 'Exigências do Edital', status: 'Disponível', detalhe: 'Verificar edital na íntegra' },
            { titulo: 'Riscos Identificados', status: 'Atenção', riscosCount: '1 ponto de atenção' },
          ],
          precos: {
            nossoPreco: 0,
            estimativaEdital: 0,
            precoMinimoSustentavel: 0,
            custoProduto: 0,
            custoLogistico: 0,
            impostosValor: 0,
            taxasAdministrativas: 0,
            margemEstimadaPercent: 0,
            margemEstimadaValor: 0,
          },
          viabilidadeDetalhada: null,
          exigencias: [
            { id: '1', categoria: 'Qualificação Técnica', status: 'A verificar' },
            { id: '2', categoria: 'Regularidade Fiscal', status: 'Exigida' },
            { id: '3', categoria: 'Proposta de Preços', status: 'Requer orçamentação' },
          ],
        };

        return res.json({ success: true, data: responseData });
      }

      // Cálculo Autêntico: cruza o Regime Tributário da empresa com os custos do Catálogo de Produtos
      const userId = (req as any).user?.id;
      const companyId = query.companyId ? String(query.companyId) : undefined;
      const catalogItemId = query.catalogItemId ? String(query.catalogItemId) : undefined;
      const regimeTributario = query.regimeTributario ? String(query.regimeTributario) : undefined;

      const resultadoAutentico = await calcularViabilidadeAutentica({
        companyId,
        userId,
        catalogItemId,
        objetoEdital: notice.object,
        estimativaEdital,
        custoProdutoInformado: query.custoProduto ? Number(query.custoProduto) : undefined,
        percentualImpostosInformado: query.percentualImpostos ? Number(query.percentualImpostos) : undefined,
        custoLogistico: query.custoLogistico ? Number(query.custoLogistico) : undefined,
        taxasAdministrativas: query.taxasAdministrativas ? Number(query.taxasAdministrativas) : undefined,
        margemDesejadaPercentual: query.margemDesejadaPercentual ? Number(query.margemDesejadaPercentual) : undefined,
        precoLance: query.precoLance ? Number(query.precoLance) : undefined,
        regimeTributario,
      });

      const {
        viabilidade,
        custoProdutoTotal: custoProduto,
        aliquotaImpostosUtilizada: percentualImpostos,
        precoMinimoSustentavel,
        precoSugerido: nossoPreco,
        classificacao,
        scorePercentual,
        scoreDescricao,
        itensCatalogoUtilizados,
        origemCustoProduto,
        regimeTributarioUtilizado,
      } = resultadoAutentico;

      const margemReal = viabilidade.margemLucroRealPercentual;
      const margemValor = viabilidade.margemLucroRealValor;
      const impostosValor = viabilidade.impostosValor;
      const custoLogistico = viabilidade.custoLogistico;
      const taxasAdministrativas = viabilidade.taxasAdministrativas;

      const responseData: AnaliseViabilidadeData = {
        editalId: notice.id,
        editalNumero: notice.noticeNumber || notice.externalId || 'Edital Oficial',
        orgao: notice.buyerName || 'Órgão Licitante',
        objeto: notice.object || 'Fornecimento / Prestação de serviços conforme termo de referência do edital',
        uf: notice.uf,
        municipio: notice.municipality,
        modalidade: notice.modality || 'Pregão Eletrônico',
        dataAbertura: notice.openingAt?.toISOString() || null,
        score: {
          percentual: scorePercentual,
          classificacao,
          descricao: scoreDescricao,
        },
        resumo: [
          {
            titulo: 'Estudo de Custos e Preços',
            status: classificacao === 'INVIÁVEL' ? 'Inviável' : 'Concluído',
            detalhe: `Preço mínimo saudável: R$ ${precoMinimoSustentavel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          },
          {
            titulo: 'Compatibilidade Orçamentária',
            status: precoMinimoSustentavel <= estimativaEdital ? 'Dentro do Teto' : 'Acima do Teto',
            detalhe: `Teto do Edital: R$ ${estimativaEdital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          },
          {
            titulo: 'Análise de Margem Líquida',
            status: margemReal >= 10 ? 'Margem Saudável' : 'Margem de Risco',
            detalhe: `${margemReal.toFixed(1)}% líquido estimado`,
          },
          {
            titulo: 'Prazos Operacionais',
            status: notice.openingAt ? 'Cronograma Ativo' : 'Aguardando publicação',
            riscosCount: notice.openingAt ? undefined : 'Data pendente',
          },
        ],
        precos: {
          nossoPreco,
          estimativaEdital,
          precoMinimoSustentavel,
          custoProduto,
          custoLogistico,
          impostosValor,
          taxasAdministrativas,
          margemEstimadaPercent: margemReal,
          margemEstimadaValor: margemValor,
        },
        viabilidadeDetalhada: viabilidade,
        exigencias: [
          { id: '1', categoria: 'Habilitação Jurídica', status: 'Atendido' },
          { id: '2', categoria: 'Regularidade Fiscal e Trabalhista', status: 'Conforme Certidões' },
          { id: '3', categoria: 'Qualificação Econômico-Financeira', status: 'Balanço / Índices' },
          { id: '4', categoria: 'Qualificação Técnica', status: 'Atestados de Capacidade' },
          { id: '5', categoria: 'Declarações Obrigatórias', status: 'Minutas Padrão' },
        ],
        lex: {
          parecerExequibilidade: precoMinimoSustentavel <= estimativaEdital
            ? 'Proposta financeiramente sustentável e em plena conformidade com o Art. 59, III da Lei 14.133/2021.'
            : 'Atenção: Margem apertada frente aos custos estimados diretos.',
          recomendacaoEstrategica: margemReal >= 10
            ? 'Edital altamente viável para disputa eletrônica com boa margem competitiva.'
            : 'Recomendada cautela na fase de lances para preservar o break-even operacional.',
          alertas: [
            {
              risco: precoMinimoSustentavel > estimativaEdital ? 'Alto' : 'Médio',
              titulo: 'Compatibilidade Orçamentária e Preço Mínimo',
              mensagem: precoMinimoSustentavel > estimativaEdital
                ? 'Preço mínimo sustentável calculado está acima do valor teto estimado do certame. Risco alto de desclassificação ou prejuízo operacional.'
                : 'Verificar alíquota de impostos e custos de frete interestadual para manter a margem líquida dentro da meta.',
            },
            {
              risco: !notice.openingAt ? 'Atenção' : 'Médio',
              titulo: 'Prazo e Sessão de Disputa',
              mensagem: notice.openingAt
                ? 'Acompanhar abertura e prazos de impugnação até 3 dias úteis antes da sessão pública (Art. 164 da Lei 14.133/21).'
                : 'Data da sessão ainda não publicada oficialmente. Requer acompanhamento no PNCP.',
            },
            {
              risco: margemReal < 10 ? 'Alto' : 'Atenção',
              titulo: 'Margem Líquida Operacional',
              mensagem: margemReal < 10
                ? 'Margem operacional estimada inferior a 10%. Recomendada cautela em lances agressivos.'
                : 'Margem estimada saudável, porém atente-se às exigências de atestados e certidões no termo de referência.',
            },
          ],
        },
        lexAnalysis: {
          parecerExequibilidade: precoMinimoSustentavel <= estimativaEdital
            ? 'Proposta financeiramente sustentável e em plena conformidade com o Art. 59, III da Lei 14.133/2021.'
            : 'Atenção: Margem apertada frente aos custos estimados diretos.',
          alertasRiscos: [
            'Acompanhar cronograma de esclarecimentos e impugnação até 3 dias úteis antes da abertura.',
            'Assegurar margem de segurança contra flutuação de custos de frete interestadual.',
            precoMinimoSustentavel > estimativaEdital
              ? 'Risco Alto: Preço mínimo sustentável calculado está acima do valor estimado.'
              : 'Conformidade de preços verificada perante o teto do certame.',
          ],
          recomendacaoEstrategica: margemReal >= 10
            ? 'Edital altamente viável para disputa eletrônica com boa margem competitiva.'
            : 'Recomendada cautela na fase de lances para preservar o break-even operacional.',
        },
      };

      return res.json({
        success: true,
        data: responseData,
      });
    } catch (error: any) {
      console.error('[AnaliseViabilidadeController] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar análise de viabilidade do edital',
      });
    }
  }
}
import { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { AiGroundingService, AiGroundedResponse } from '../services/ai-grounding.service';
import { calcularViabilidadeAutentica } from '../services/viabilidade.service';
import { parecerJuridicoPdfService } from '../services/parecer-juridico-pdf.service';
import { buscarLicitacaoPorIdOuControle } from '../services/licitacoes.service';
import {
  chatWithProvider,
  streamGroundedResultToSse,
  MissingApiKeyError,
  AiTimeoutError,
  ProviderUnavailableError,
} from '../services/ai.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

export class LexController {
  private readonly grounding: AiGroundingService;

  constructor(groundingService?: AiGroundingService) {
    this.grounding = groundingService || new AiGroundingService(undefined, chatWithProvider);
  }

  async chat(req: AuthRequest, res: Response) {
    try {
      const { messages, contextoEdital, contexto, noticeId, licitacaoId, edital_id, stream } = (req.body || {}) as {
        messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
        contextoEdital?: string;
        contexto?: string;
        noticeId?: string;
        licitacaoId?: string;
        edital_id?: string;
        stream?: boolean;
      };

      const pergunta = (req.body?.pergunta || req.body?.message || lastUserMessage(messages) || '').trim();
      if (!pergunta) {
        return res.status(400).json({ success: false, message: 'Mensagens inválidas ou pergunta vazia.' });
      }

      const resolvedId = noticeId || licitacaoId || edital_id;
      const documentText = (contextoEdital || contexto || '').trim().slice(0, 8000);
      const conversationContext = (messages || [])
        .slice(-8)
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .map((message) => `[${message.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}]\n${message.content.slice(0, 2000)}`)
        .join('\n\n');
      const groundingInput = {
        pergunta,
        contexto: documentText || undefined,
        providedDocumentText: documentText || undefined,
        conversationContext: conversationContext || undefined,
        noticeId: resolvedId,
        purpose: 'lex_chat_grounded',
        metadata: { endpoint: '/lex/chat' },
      };
      const groundingContext = buildGroundingContext(req);
      const isStream = stream !== false && req.query?.stream !== 'false';

      if (isStream) {
        return streamGroundedResultToSse(
          res,
          (onChunk) => this.grounding.runLex({
            ...groundingInput,
            options: { onChunk },
          }, groundingContext),
          { endpoint: '/lex/chat', noticeId: resolvedId },
        );
      }

      const result = await this.grounding.runLex(groundingInput, groundingContext);
      return groundedResponse(res, result);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async auditar(req: AuthRequest, res: Response) {
    try {
      const noticeId = resolveNoticeId(req);
      const textoEditalInformado = typeof req.body?.texto_edital === 'string'
        ? req.body.texto_edital.trim().slice(0, 8000)
        : '';
      if (!noticeId && !textoEditalInformado) {
        return res.status(400).json({
          success: false,
          message: 'Informe um edital cadastrado (noticeId) ou o texto do edital para análise.',
        });
      }

      const isStream =
        req.body?.stream === true ||
        req.query.stream === 'true' ||
        req.headers.accept?.includes('text/event-stream');

      const groundingInput = {
        pergunta: req.body?.pergunta
          || 'Audite preliminarmente o edital e liste apenas pontos de atenção sustentados pelas fontes disponíveis.',
        contexto: textoEditalInformado || undefined,
        providedDocumentText: textoEditalInformado || undefined,
        noticeId,
        purpose: 'lex_auditoria_preliminar',
        metadata: { endpoint: '/lex/auditar' },
      };
      const groundingContext = buildGroundingContext(req);

      if (isStream) {
        return streamGroundedResultToSse(
          res,
          (onChunk) => this.grounding.runLex({
            ...groundingInput,
            options: { onChunk },
          }, groundingContext),
          { noticeId, endpoint: '/lex/auditar' },
        );
      }

      const result = await this.grounding.runLex(groundingInput, groundingContext);

      return groundedResponse(res, result);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async resumo(req: AuthRequest, res: Response) {
    try {
      const noticeId = resolveNoticeId(req);
      const result = await this.grounding.runLex(
        {
          pergunta:
            'Explique este edital em português simples e linguagem comercial para um fornecedor: diga o que o governo quer comprar, como a empresa pode participar, quais prazos e documentos são verificáveis nas fontes e quais riscos ou pontos de atenção podem afetar custo, entrega ou habilitação. Organize a resposta em tópicos claros. Não invente datas, exigências nem riscos; quando a fonte não trouxer um dado, informe que ele precisa ser confirmado no edital oficial.',
          noticeId,
          purpose: 'lex_resumo_grounded',
          metadata: { endpoint: '/lex/resumo' },
        },
        buildGroundingContext(req),
      );

      const rawText = (result.resposta || result.content || '').trim();
      const noticeExcerpt = result.citations.find(
        (citation) => citation.sourceType === 'procurement_notice',
      )?.excerpt;
      const extra = {
        visao_geral: rawText,
        objeto_resumido: noticeExcerpt || 'Objeto não identificado nas fontes recuperadas.',
        o_que_exige_do_licitante: [],
        datas_criticas: [],
        alertas: result.limitations,
        recomendacao_final: result.blocked
          ? 'A análise ficou bloqueada por falta de fontes verificáveis.'
          : rawText,
      };

      return groundedResponse(res, result, extra);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async proposta(req: AuthRequest, res: Response) {
    try {
      const { nome_empresa } = (req.body || {}) as { nome_empresa?: string };
      const noticeId = resolveNoticeId(req);
      const result = await this.grounding.runLex(
        {
          pergunta: `Liste insumos para proposta comercial de ${
            nome_empresa || 'empresa licitante'
          } somente com base no edital recuperado. Não invente preço, margem ou requisito ausente.`,
          noticeId,
          purpose: 'lex_proposta_insumos_grounded',
          metadata: { endpoint: '/lex/proposta', nomeEmpresa: nome_empresa ?? null },
        },
        buildGroundingContext(req),
      );

      const rawText = (result.resposta || result.content || '').trim();
      const extra = {
        estrategia_precificacao: 'Estratégia baseada no teto estimado do edital e margem líquida sustentável',
        margem_sugerida: '12% a 18% líquida',
        proposta_comercial: rawText || 'Proposta comercial estruturada conforme exigências do edital',
        pontos_destaque: [
          'Atendimento integral às especificações técnicas',
          'Prazo de entrega rigorosamente compatível com o termo de referência',
          'Garantia legal e suporte operacional inclusos',
        ],
      };

      return groundedResponse(res, result, extra);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async impugnacao(req: AuthRequest, res: Response) {
    try {
      const { contexto } = (req.body || {}) as { contexto?: string };
      const noticeId = resolveNoticeId(req);
      const result = await this.grounding.runLex(
        {
          pergunta:
            'Liste pontos de atenção que podem exigir revisão jurídica para eventual impugnação e analise o prazo tempestivo. Não redija peça final e não afirme ilegalidade.',
          contexto,
          noticeId,
          purpose: 'lex_impugnacao_precheck',
          metadata: { endpoint: '/lex/impugnacao' },
        },
        buildGroundingContext(req),
      );

      const rawText = (result.resposta || result.content || '').trim();
      const extra = {
        tese_central: 'Inconformidade ou excesso de rigor em exigência editalícia',
        fundamentos: ['Art. 9º, I, da Lei 14.133/2021 (Vedação a cláusulas restritivas de competitividade)', 'Súmula 222 do TCU'],
        pedidos: ['Recebimento da presente impugnação tempestiva', 'Retificação do edital com republicação do prazo'],
        texto_impugnacao: rawText || 'Minuta jurídica fundamentada conforme disposições da Lei 14.133/2021.',
      };

      return groundedResponse(res, result, extra);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async gerarRecurso(req: AuthRequest, res: Response) {
    try {
      const { motivoDesclassificacao, contextoAdicional } = (req.body || {}) as {
        motivoDesclassificacao?: string;
        contextoAdicional?: string;
      };

      const instrucao = `
Aja como especialista em contratações públicas sob a Lei 14.133/2021.
O motivo apontado para desclassificação/inabilitação foi: "${motivoDesclassificacao || 'Não especificado'}".
Contexto adicional: "${contextoAdicional || ''}".
Com base no edital recuperado e nas orientações do TCU, elabore tópicos de recurso administrativo.
Não declare que houve crime, dolo ou ilegalidade consumada. Aponte princípios da razoabilidade, proporcionalidade e vinculação ao instrumento convocatório como teses a serem revisadas por advogado.
      `.trim();

      const result = await this.grounding.runLex(
        {
          pergunta: instrucao,
          noticeId: resolveNoticeId(req),
          purpose: 'lex_recurso_administrativo',
          metadata: { endpoint: '/lex/recurso' },
        },
        buildGroundingContext(req),
      );

      return groundedResponse(res, result);
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  async extrairParaProposta(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, code: 'unauthenticated', message: 'Usuário não autenticado.' });
    }

    try {
      const {
        noticeId: rawNoticeId,
        licitacaoId,
        edital_id,
        editalId,
        proposalId,
        companyId,
        autoCreate,
      } = (req.body || {}) as {
        noticeId?: string;
        licitacaoId?: string;
        edital_id?: string;
        editalId?: string;
        proposalId?: string;
        companyId?: string;
        autoCreate?: boolean;
      };

      const noticeId = rawNoticeId || licitacaoId || edital_id || editalId || resolveNoticeId(req);
      if (!noticeId) {
        return res.status(400).json({ success: false, message: 'ID do edital não fornecido (noticeId).' });
      }

      const cleanNoticeId = String(noticeId).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanNoticeId);
      const whereConditions: any[] = [
        { externalId: cleanNoticeId },
        { dedupeKey: `pncp-${cleanNoticeId}` },
        { dedupeKey: cleanNoticeId },
        { noticeNumber: cleanNoticeId },
      ];
      if (isUuid) {
        whereConditions.unshift({ id: cleanNoticeId });
      }

      let notice = await prisma.procurementNotice.findFirst({
        where: {
          AND: [
            {
              OR: whereConditions,
            },
            tenantVisibilityWhere(req.user?.tenantId),
          ],
        },
        include: {
          attachments: {
            take: 5,
          },
          items: {
            take: 50,
            orderBy: { itemNumber: 'asc' },
          },
        },
      });

      // Se não encontrou no banco local, busca no PNCP oficial e persiste automaticamente
      if (!notice) {
        try {
          const fetched = await buscarLicitacaoPorIdOuControle(cleanNoticeId, { requirePersistence: true });
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
              include: {
                attachments: {
                  take: 5,
                },
                items: {
                  take: 50,
                  orderBy: { itemNumber: 'asc' },
                },
              },
            });
          }
        } catch (fetchErr) {
          console.warn('[LexController] Falha ao sincronizar edital remoto do PNCP:', fetchErr);
        }
      }

      if (!notice) {
        return res.status(404).json({
          success: false,
          code: 'NOTICE_NOT_FOUND',
          message: 'Edital não encontrado no banco de dados nem no portal oficial.',
        });
      }

      // Busca também chunks de texto associados ao edital no repositório de documentos
      const documentChunks = await prisma.documentChunk.findMany({
        where: {
          AND: [
            {
              sourceType: { in: ['procurement_notice', 'ProcurementNotice'] },
              sourceId: notice.id,
            },
            tenantVisibilityWhere(req.user?.tenantId),
          ],
        },
        take: 10,
        orderBy: { chunkIndex: 'asc' },
      });

      const chunksText = [
        ...(notice.attachments || []).map((a) => a.extractedText).filter(Boolean),
        ...(documentChunks || []).map((c) => c.content).filter(Boolean),
      ].join('\n\n').slice(0, 8000);
      const structuredExtraction = extractStructuredItems(notice);
      let extracted: any = hasValidProposalItems(structuredExtraction.itens)
        ? structuredExtraction
        : null;

      // Fallback Inteligente: Se o edital veio do PNCP sem itens cadastrados no cabeçalho e sem anexo baixado,
      // sintetiza um item inicial oficial com base no objeto e valor estimado da contratação
      if (!extracted && !chunksText.trim() && notice.object) {
        extracted = {
          criterioJulgamento: notice.judgmentCriterion || 'menor_preco',
          modoDisputa: notice.modoDisputa || 'Aberto',
          prazoValidadeDias: 60,
          prazoEntregaDias: 15,
          itens: [
            {
              numero: '1',
              descricao: notice.object,
              unidade: 'UN',
              quantidade: 1,
              marca: null,
              modelo: null,
              valorEstimadoUnitario: notice.estimatedValue ? Number(notice.estimatedValue) : null,
            },
          ],
        };
      } else if (!extracted && !chunksText.trim()) {
        return res.status(422).json({
          success: false,
          code: 'NOTICE_ITEMS_UNAVAILABLE',
          message: 'O edital não possui itens estruturados nem texto extraído suficiente para preenchimento.',
        });
      }

      const prompt = `
Você é o LEX, assistente de inteligência jurídica especialista em licitações públicas sob a égide da Lei Federal nº 14.133/2021.
Analise as informações do edital a seguir e extraia os dados necessários para formulação da Proposta Comercial Oficial.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown, sem explicações adicionais, apenas o JSON puro) com a seguinte estrutura:
{
  "criterioJulgamento": "menor_preco" | "maior_desconto" | "melhor_tecnica" | "tecnica_e_preco" | "maior_lance" | "maior_retorno_economico",
  "modoDisputa": "Aberto" | "Aberto e Fechado" | "Fechado e Aberto" | "Dispensa",
  "prazoValidadeDias": number | null,
  "prazoEntregaDias": number | null,
  "itens": [
    {
      "numero": string,
      "descricao": string,
      "unidade": string,
      "quantidade": number,
      "marca": string | null,
      "modelo": string | null,
      "valorEstimadoUnitario": number | null
    }
  ]
}

Dados do Edital:
Número: ${notice.noticeNumber || notice.externalId || 'Não informado'}
Órgão: ${notice.buyerName || 'Não informado'}
Objeto: ${notice.object}
Modalidade: ${notice.modality || 'Pregão Eletrônico'}
Critério atual: ${notice.judgmentCriterion || 'menor_preco'}
Modo de disputa atual: ${notice.modoDisputa || 'Aberto e Fechado'}
Trechos e Especificações Técnicas:
${chunksText}
`.trim();

      if (!extracted) {
        try {
          const response = await chatWithProvider([
            { role: 'user', content: prompt },
          ]);
          const cleaned = response.content.replace(/```json/gi, '').replace(/```/g, '').trim();
          try {
            extracted = JSON.parse(cleaned);
          } catch {
            console.warn('[LexController] Resposta da IA não foi JSON puro, aplicando fallback estruturado.');
          }
        } catch (aiErr) {
          console.warn('[LexController] Modelo de IA indisponível ou com erro, aplicando fallback dos dados do edital:', aiErr);
        }
      }

      if (!extracted || !hasValidProposalItems(extracted.itens)) {
        if (notice.items && notice.items.length > 0) {
          extracted = {
            criterioJulgamento: notice.judgmentCriterion || 'menor_preco',
            modoDisputa: notice.modoDisputa || 'Aberto',
            prazoValidadeDias: 60,
            prazoEntregaDias: 15,
            itens: notice.items.map((it, idx) => ({
              numero: String(it.itemNumber || idx + 1),
              descricao: it.description || notice.object,
              unidade: it.unit || 'UN',
              quantidade: Number(it.quantity) || 1,
              marca: null,
              modelo: null,
              valorEstimadoUnitario: it.estimatedUnitValue ? Number(it.estimatedUnitValue) : null,
            })),
          };
        } else if (notice.object) {
          extracted = {
            criterioJulgamento: notice.judgmentCriterion || 'menor_preco',
            modoDisputa: notice.modoDisputa || 'Aberto',
            prazoValidadeDias: 60,
            prazoEntregaDias: 15,
            itens: [
              {
                numero: '1',
                descricao: notice.object,
                unidade: 'UN',
                quantidade: 1,
                marca: null,
                modelo: null,
                valorEstimadoUnitario: notice.estimatedValue ? Number(notice.estimatedValue) : null,
              },
            ],
          };
        }
      }

      if (!extracted || !hasValidProposalItems(extracted.itens)) {
        return res.status(422).json({
          success: false,
          code: 'AI_EXTRACTION_INCOMPLETE',
          message: 'Não foi possível identificar com segurança todos os itens, quantidades e unidades do edital.',
        });
      }

      if (autoCreate === false && !proposalId) {
        return res.json({ success: true, data: { extracted } });
      }

      let targetCompanyId = companyId || req.companyId;
      if (targetCompanyId) {
        const ownedCompany = await prisma.company.findFirst({
          where: { id: targetCompanyId, userId },
        });
        if (!ownedCompany) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado para a empresa informada.',
          });
        }
        targetCompanyId = ownedCompany.id;
      } else {
        const comp = await prisma.company.findFirst({ where: { userId } });
        if (!comp) {
          return res.status(404).json({ success: false, message: 'Empresa do usuário não encontrada. Cadastre uma empresa para gerar propostas.' });
        }
        targetCompanyId = comp.id;
      }

      // 1. Busca o Catálogo de Produtos da empresa para cruzamento inteligente
      const catalogoItens = await prisma.catalogItem.findMany({
        where: {
          companyId: targetCompanyId,
          status: 'ATIVO',
        },
      });

      // 2. Se proposalId foi enviado, atualiza a proposta existente; caso contrário, cria uma nova
      const validadeDias = optionalPositiveInteger(extracted.prazoValidadeDias);
      const prazoEntregaDias = optionalPositiveInteger(extracted.prazoEntregaDias);
      const criterioJulgamento = normalizeJudgmentCriterion(extracted.criterioJulgamento)
        || notice.judgmentCriterion
        || undefined;
      let proposal: any = null;
      if (proposalId) {
        proposal = await prisma.proposal.findFirst({
          where: { id: proposalId, company: { userId } },
        });
        if (!proposal) {
          return res.status(404).json({
            success: false,
            code: 'PROPOSAL_NOT_FOUND',
            message: 'Proposta não encontrada para a empresa autenticada.',
          });
        }
        await prisma.proposalItem.deleteMany({
          where: { proposalId: proposal.id },
        });
        proposal = await prisma.proposal.update({
          where: { id: proposal.id },
          data: {
            procurementNoticeId: notice.id,
            criterioJulgamento: criterioJulgamento || proposal.criterioJulgamento || undefined,
            validadeDias: validadeDias ?? proposal.validadeDias,
            prazoEntregaDias: prazoEntregaDias ?? proposal.prazoEntregaDias,
          },
        });
      }

      if (!proposal) {
        proposal = await prisma.proposal.create({
          data: {
            companyId: targetCompanyId,
            procurementNoticeId: notice.id,
            titulo: `Proposta Oficial - ${notice.noticeNumber || notice.object.slice(0, 60)}`,
            status: 'RASCUNHO',
            moeda: 'BRL',
            criterioJulgamento,
            validadeDias,
            prazoEntregaDias,
            declaracaoIndependente: false,
            declaracaoHabilitacao: false,
            declaracaoMenor: false,
            declaracaoMeEpp: false,
            declaracaoInidoneidade: false,
            declaracaoAcessibilidade: false,
            createdById: userId,
          },
        });
      }

      const createdItems = [];
      const itens = extracted.itens;

      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        const itDesc = String(it.descricao || '').toLowerCase();

        // Cruzamento inteligente com Catálogo de Produtos da empresa
        const matchedCatalog = catalogoItens.find((cat) => {
          const catNome = (cat.nome || '').toLowerCase();
          const catSku = (cat.sku || '').toLowerCase();
          const catMat = (cat.codigoCatmat || '').toLowerCase();
          return (
            (catMat && itDesc.includes(catMat)) ||
            (catSku && itDesc.includes(catSku)) ||
            (catNome.length >= 3 && itDesc === catNome)
          );
        });

        const valEst = Number.isFinite(Number(it.valorEstimadoUnitario)) && Number(it.valorEstimadoUnitario) > 0
          ? Number(it.valorEstimadoUnitario)
          : null;
        const custoDireto = matchedCatalog?.custoBase != null && Number(matchedCatalog.custoBase) > 0
          ? Number(matchedCatalog.custoBase)
          : null;
        const precoCatalogo = matchedCatalog?.precoMinimoLicitacao != null && Number(matchedCatalog.precoMinimoLicitacao) > 0
          ? Number(matchedCatalog.precoMinimoLicitacao)
          : null;
        let marca = it.marca ? String(it.marca).trim() : null;
        let modelo = it.modelo ? String(it.modelo).trim() : null;
        let descricaoFinal = String(it.descricao).trim();

        if (matchedCatalog) {
          if (matchedCatalog.sku) {
            modelo = matchedCatalog.sku;
          }
          if (matchedCatalog.codigoCatmat) {
            descricaoFinal += ` [CATMAT: ${matchedCatalog.codigoCatmat}]`;
          }
        }

        const qtd = Number(it.quantidade);
        const createdItem = await prisma.proposalItem.create({
          data: {
            proposalId: proposal.id,
            posicao: i + 1,
            numero: String(it.numero || i + 1),
            descricao: descricaoFinal,
            unidade: String(it.unidade).trim(),
            quantidade: qtd,
            marca,
            modelo,
            custoDireto,
            custoUnitario: custoDireto,
            precoUnitarioProposto: null,
            precoTotalProposto: null,
            catalogoPrecoReferencia: precoCatalogo ?? valEst,
            margemLucroPercentual: null,
            inexequivel: false,
            observacoes: precoCatalogo
              ? 'Preço inicial do catálogo da empresa. Revise custos e condições do edital antes de enviar.'
              : valEst
                ? 'Preço estimado do PNCP usado como referência inicial. Revise custos e defina seu preço antes de enviar.'
                : null,
          },
        });
        createdItems.push(createdItem);
      }

      const total = createdItems.every((item) => item.precoTotalProposto != null)
        ? createdItems.reduce((acc, item) => acc + Number(item.precoTotalProposto), 0)
        : null;
      const updatedProposal = await prisma.proposal.update({
        where: { id: proposal.id },
        data: { valorTotalProposto: total },
        include: {
          items: { orderBy: { posicao: 'asc' } },
          procurementNotice: true,
          company: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          proposalId: proposal.id,
          proposal: updatedProposal,
          items: createdItems,
          extracted,
        },
      });
    } catch (err: any) {
      return handleLexError(res, err);
    }
  }

  // Alias semântico para Preencher Proposta via LEX
  async preencherProposta(req: AuthRequest, res: Response) {
    return this.extrairParaProposta(req, res);
  }

  // Exportação Oficial de Parecer Jurídico Formatado ABNT com Timbre & Assinatura Digital
  async exportarParecerPdf(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const { editalSelecionado, editalDetalhes, clausulas, companyId } = (req.body || {}) as {
        editalSelecionado?: string;
        editalDetalhes?: { orgao?: string; objeto?: string; modalidade?: string };
        clausulas?: any[];
        resumo?: any;
        companyId?: string;
      };

      if (!editalSelecionado?.trim() || !editalDetalhes?.orgao?.trim() || !editalDetalhes.objeto?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Informe o número, órgão e objeto do edital real para gerar o PDF.',
        });
      }
      if (
        !Array.isArray(clausulas)
        || clausulas.length === 0
        || clausulas.some((clausula) =>
          typeof clausula?.item !== 'string'
          || !clausula.item.trim()
          || typeof clausula?.textoClausula !== 'string'
          || !clausula.textoClausula.trim()
          || typeof clausula?.categoria !== 'string'
          || !clausula.categoria.trim()
          || typeof clausula?.analiseLex !== 'string'
          || !clausula.analiseLex.trim()
          || !['ALTO', 'MEDIO', 'BAIXO'].includes(clausula?.nivelRisco))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Inclua cláusulas extraídas do edital e análises correspondentes antes de gerar o PDF.',
        });
      }

      // 1. Localiza a empresa do cliente para inclusão do timbre oficial e CNPJ
      let targetCompanyId = companyId || req.companyId;
      let empresa: any = null;

      if (targetCompanyId) {
        empresa = await prisma.company.findFirst({
          where: { id: targetCompanyId, userId },
        });
      }

      if (!empresa) {
        empresa = await prisma.company.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
      }

      if (!empresa) {
        return res.status(400).json({
          success: false,
          message: 'Cadastre os dados da empresa antes de gerar o PDF.',
        });
      }

      const dadosEmpresa = {
        razaoSocial: empresa.razaoSocial || empresa.nomeFantasia,
        nomeFantasia: empresa.nomeFantasia || null,
        cnpj: empresa.cnpj,
        municipio: empresa.municipio || '',
        uf: empresa.uf || '',
      };

      const dadosEdital = {
        numero: editalSelecionado.trim(),
        orgao: editalDetalhes.orgao.trim(),
        objeto: editalDetalhes.objeto.trim(),
        modalidade: editalDetalhes.modalidade?.trim() || 'Não informada',
      };

      const pdfBuffer = await parecerJuridicoPdfService.gerarParecerPdf({
        empresa: dadosEmpresa,
        edital: dadosEdital,
        resumo: {
          totalClausulas: clausulas.length,
          pontosCriticos: clausulas.filter((clausula) => clausula.nivelRisco === 'ALTO').length,
          ambiguidades: clausulas.filter((clausula) => clausula.categoria === 'AMBIGUIDADE').length,
          indiceConformidade: 'Não calculado',
        },
        clausulas,
      });

      const fileName = `Parecer_Juridico_LEX_${dadosEdital.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err: any) {
      console.error('[LEX Controller] Erro ao exportar parecer jurídico em PDF:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar o PDF do parecer jurídico timbrado.',
      });
    }
  }

  async analise(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Usuário não autenticado.',
      });
    }

    try {
      const noticeId = resolveNoticeId(req);
      if (!noticeId) {
        return res.status(400).json({ success: false, message: 'ID do edital não fornecido (noticeId).' });
      }

      const notice = await prisma.procurementNotice.findFirst({
        where: {
          AND: [
            {
              OR: [
                { id: noticeId },
                { externalId: noticeId },
                { noticeNumber: noticeId },
              ],
            },
            tenantVisibilityWhere(req.user?.tenantId),
          ],
        },
      });
      if (!notice) {
        return res.status(404).json({ success: false, code: 'NOTICE_NOT_FOUND', message: 'Edital não localizado.' });
      }

      const estimatedValue = Number(notice.estimatedValue);
      if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
        return res.status(422).json({
          success: false,
          code: 'NOTICE_ESTIMATED_VALUE_UNAVAILABLE',
          message: 'O edital não possui valor estimado válido para cálculo de viabilidade.',
        });
      }

      const body = req.body || {};
      const optionalNumber = (value: unknown) =>
        value == null || value === '' ? undefined : Number(value);
      const inputNumbers = {
        custoProdutoInformado: optionalNumber(body.custoProduto),
        percentualImpostosInformado: optionalNumber(body.percentualImpostos),
        custoLogistico: optionalNumber(body.custoLogistico),
        taxasAdministrativas: optionalNumber(body.taxasAdministrativas),
        margemDesejadaPercentual: optionalNumber(body.margemDesejadaPercentual),
        precoLance: optionalNumber(body.precoLance),
      };
      if (Object.values(inputNumbers).some((value) => value !== undefined && !Number.isFinite(value))) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_VIABILITY_INPUT',
          message: 'Informe valores numéricos válidos para os custos e percentuais.',
        });
      }

      const result = await calcularViabilidadeAutentica({
        userId,
        companyId: typeof body.companyId === 'string' ? body.companyId : undefined,
        catalogItemId: typeof body.catalogItemId === 'string' ? body.catalogItemId : undefined,
        catalogItemIds: Array.isArray(body.catalogItemIds)
          ? body.catalogItemIds.filter((value: unknown): value is string => typeof value === 'string')
          : undefined,
        objetoEdital: notice.object,
        estimativaEdital: estimatedValue,
        ...inputNumbers,
        regimeTributario: typeof body.regimeTributario === 'string'
          ? body.regimeTributario
          : undefined,
      });

      if (result.origemCustoProduto === 'SEM_PRODUTO_VINCULADO') {
        return res.status(422).json({
          success: false,
          code: 'PRODUCT_COST_REQUIRED',
          message: 'Vincule um item do catálogo ou informe o custo real do produto antes de calcular a viabilidade.',
        });
      }

      const { viabilidade } = result;
      const premissas: string[] = [];
      if (result.origemTributacao === 'SIMPLES_NACIONAL_PADRAO') {
        premissas.push('Foi usada a alíquota padrão do Simples Nacional; confirme o regime tributário da empresa.');
      }
      if (inputNumbers.custoLogistico === undefined) {
        premissas.push('O custo logístico foi estimado automaticamente e precisa ser confirmado.');
      }
      if (inputNumbers.taxasAdministrativas === undefined) {
        premissas.push('As taxas administrativas foram estimadas automaticamente e precisam ser confirmadas.');
      }
      if (inputNumbers.precoLance === undefined) {
        premissas.push('O preço orientativo usa uma margem-alvo e não substitui cotação ou decisão comercial.');
      }

      const parecerExequibilidade = viabilidade.margemLucroRealValor < 0
        ? 'Com os valores informados, os custos superam o preço de referência usado no cálculo.'
        : 'Resultado calculado a partir dos custos e premissas informados; não constitui validação jurídica do edital.';
      const recomendacao = premissas.length
        ? 'Revise as premissas antes de usar este resultado para definir um lance.'
        : 'Revise os valores de origem e confirme a estratégia comercial antes de registrar um lance.';
      const alertas = premissas.map((mensagem) => ({
        risco: 'Atenção',
        titulo: 'Premissa a confirmar',
        mensagem,
      }));
      const payload = {
        editalId: notice.id,
        editalNumero: notice.noticeNumber || notice.externalId,
        orgao: notice.buyerName,
        objeto: notice.object,
        uf: notice.uf,
        municipio: notice.municipality,
        modalidade: notice.modality,
        dataAbertura: notice.openingAt?.toISOString() || null,
        score: {
          percentual: result.scorePercentual,
          classificacao: result.classificacao,
          descricao: result.scoreDescricao,
        },
        resumo: [
          {
            titulo: 'Custo do produto',
            status: result.origemCustoProduto,
            detalhe: `R$ ${result.custoProdutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          },
          {
            titulo: 'Tributação',
            status: result.origemTributacao,
            detalhe: `${result.aliquotaImpostosUtilizada}% (${result.regimeTributarioUtilizado})`,
          },
          {
            titulo: 'Margem calculada',
            status: viabilidade.margemSaudavel ? 'Margem saudável' : 'Margem abaixo do parâmetro',
            detalhe: `${viabilidade.margemLucroRealPercentual}%`,
          },
        ],
        precos: {
          nossoPreco: result.precoSugerido,
          estimativaEdital: estimatedValue,
          precoMinimoSustentavel: result.precoMinimoSustentavel,
          custoProduto: result.custoProdutoTotal,
          custoLogistico: viabilidade.custoLogistico,
          impostosValor: viabilidade.impostosValor,
          taxasAdministrativas: viabilidade.taxasAdministrativas,
          margemEstimadaPercent: viabilidade.margemLucroRealPercentual,
          margemEstimadaValor: viabilidade.margemLucroRealValor,
        },
        viabilidadeDetalhada: viabilidade,
        origemCustoProduto: result.origemCustoProduto,
        origemTributacao: result.origemTributacao,
        itensCatalogoUtilizados: result.itensCatalogoUtilizados,
        premissas,
        exigencias: [],
        lexAnalysis: {
          parecerExequibilidade,
          alertasRiscos: premissas,
          recomendacaoEstrategica: recomendacao,
        },
        lex: {
          parecerExequibilidade,
          recomendacaoEstrategica: recomendacao,
          alertas,
        },
      };

      return res.json({ success: true, data: payload });
    } catch (error: any) {
      if (typeof error?.message === 'string' && error.message.startsWith('INVALID_')) {
        return res.status(400).json({
          success: false,
          code: error.message,
          message: 'Os dados de custo, preço ou percentual estão fora do intervalo permitido.',
        });
      }
      return handleLexError(res, error);
    }
  }

}

function extractStructuredItems(notice: any) {
  let items: any[] = [];
  if (notice.items && Array.isArray(notice.items) && notice.items.length > 0) {
    items = notice.items.map((it: any, idx: number) => ({
      numero: String(it.itemNumber || idx + 1),
      descricao: it.description,
      quantidade: it.quantity == null ? null : Number(it.quantity),
      unidade: it.unit,
      valorEstimadoUnitario: it.estimatedUnitValue == null ? null : Number(it.estimatedUnitValue),
      marca: null,
      modelo: null,
    }));
  } else if (notice.rawPayload && typeof notice.rawPayload === 'object') {
    const raw = notice.rawPayload as any;
    if (Array.isArray(raw.itens)) {
      items = raw.itens.map((it: any, idx: number) => ({
        numero: String(it.numeroItem || it.numero || idx + 1),
        descricao: it.descricao || it.especificacao,
        quantidade: it.quantidade == null ? null : Number(it.quantidade),
        unidade: it.unidadeMedida || it.unidade,
        valorEstimadoUnitario: it.valorUnitarioEstimado == null && it.valorEstimado == null
          ? null
          : Number(it.valorUnitarioEstimado ?? it.valorEstimado),
        marca: it.marca || null,
        modelo: it.modelo || null,
      }));
    }
  }

  return {
    criterioJulgamento: notice.judgmentCriterion?.toLowerCase() || null,
    modoDisputa: notice.modoDisputa || null,
    prazoValidadeDias: null,
    prazoEntregaDias: null,
    itens: items,
  };
}

function hasValidProposalItems(items: unknown): boolean {
  return Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) =>
      item &&
      typeof item.descricao === 'string' &&
      item.descricao.trim() &&
      Number.isFinite(Number(item.quantidade)) &&
      Number(item.quantidade) > 0 &&
      typeof item.unidade === 'string' &&
      item.unidade.trim(),
    );
}

function optionalPositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeJudgmentCriterion(value: unknown) {
  const allowed = [
    'menor_preco',
    'maior_desconto',
    'melhor_tecnica',
    'tecnica_e_preco',
    'maior_lance',
    'maior_retorno_economico',
  ] as const;
  if (typeof value !== 'string') return null;
  return allowed.find((criterion) => criterion === value.toLowerCase()) ?? null;
}

function tenantVisibilityWhere(tenantId?: string | null) {
  return tenantId
    ? { OR: [{ tenantId: null }, { tenantId }] }
    : { tenantId: null };
}

export function handleLexError(res: Response, err: any) {
  if (err instanceof MissingApiKeyError || err?.code === 'MISSING_API_KEY') {
    return res.status(503).json({
      success: false,
      code: 'MISSING_API_KEY',
      message: 'Serviço de IA não configurado no ambiente seguro.',
    });
  }

  if (err instanceof AiTimeoutError || err?.code === 'AI_TIMEOUT') {
    return res.status(504).json({
      success: false,
      code: 'AI_TIMEOUT',
      message: 'Tempo limite excedido ao consultar o provedor de IA. Tente novamente.',
    });
  }

  if (err instanceof ProviderUnavailableError || err?.code === 'PROVIDER_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'O provedor de IA está temporariamente indisponível.',
    });
  }

  console.error('[LEX Controller] Erro interno:', String(err?.message || err));
  return res.status(500).json({
    success: false,
    code: 'LEX_INTERNAL_ERROR',
    message: 'O LEX está temporariamente indisponível. Tente novamente mais tarde.',
  });
}

export function groundedResponse(res: Response, result: AiGroundedResponse, extraFields?: Record<string, any>) {
  const rawText = (result.resposta || result.content || '').trim();

  const payload = {
    resposta: rawText,
    answer: rawText,       // compatibilidade com componentes frontend variados
    response: rawText,     // compatibilidade com widgets
    status: result.status,
    intencao: result.intencao,
    fontes: Array.isArray(result.fontes)
      ? result.fontes
          .filter((f: any) => {
            if (!f) return false;
            if (typeof f === 'string') return f.trim().length > 0;
            const trecho = String(f.trechoRelevante || f.resumo || f.conteudo || '').trim();
            const ident = String(f.identificador || f.referencia || f.titulo || '').trim();
            const nome = String(f.fonte || f.autoridade || '').trim();
            return trecho.length > 0 || ident.length > 0 || nome.length > 0;
          })
          .map((f: any) => {
            if (typeof f === 'string') {
              return { fonte: f, identificador: f, trechoRelevante: '', tipoEpistemico: 'Fato da fonte' };
            }
            return {
              ...f,
              fonte: String(f.fonte || f.autoridade || 'Base Jurídica').trim(),
              identificador: String(f.identificador || f.referencia || f.titulo || '').trim(),
              trechoRelevante: String(f.trechoRelevante || f.resumo || f.conteudo || '').trim(),
              tipoEpistemico: f.tipoEpistemico || 'Fato da fonte',
            };
          })
      : [],
    calculos: result.calculos,
    nivelCerteza: result.nivelCerteza,
    distribuicaoEpistemica: result.distribuicaoEpistemica,
    dadosFaltantes: result.dadosFaltantes,
    aiRunId: result.aiRunId,
    retrievalSessionId: result.retrievalSessionId,
    legalAnalysisId: result.legalAnalysisId,
    provider: result.provider,
    citations: result.citations,
    sourceIds: result.sourceIds,
    chunkIds: result.chunkIds,
    ruleCodes: result.ruleCodes,
    confidence: result.confidence,
    limitations: result.limitations,
    timestamp: result.dataConsulta || new Date().toISOString(),
    ...(extraFields || {}),
  };

  if (result.blocked) {
    return res.status(422).json({
      success: false,
      message: rawText,
      data: payload,
    });
  }

  return res.json({ success: true, data: payload });
}

function lastUserMessage(messages?: Array<{ role: 'user' | 'assistant'; content: string }>) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

function resolveNoticeId(req: Request) {
  const params = req.params || {};
  const query = (req.query || {}) as Record<string, string | undefined>;
  const body = (req.body || {}) as {
    noticeId?: string;
    licitacaoId?: string;
    edital_id?: string;
    editalId?: string;
  };

  return (
    params.licitacaoId ||
    params.noticeId ||
    body.noticeId ||
    body.licitacaoId ||
    body.edital_id ||
    body.editalId ||
    query.noticeId ||
    query.licitacaoId ||
    query.edital_id ||
    query.editalId ||
    null
  );
}

function buildGroundingContext(req: AuthRequest) {
  return {
    tenantId: req.user?.tenantId ?? null,
    user: {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      isAdmin: Boolean(req.user?.isAdmin),
      permissions: req.user?.permissions ?? [],
    },
    requestId:
      (req.headers?.['x-request-id'] as string) ||
      (req.headers?.['x-correlation-id'] as string) ||
      null,
    ip: clientIp(req),
    userAgent: req.headers?.['user-agent'] || null,
  };
}

function clientIp(req: AuthRequest) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}
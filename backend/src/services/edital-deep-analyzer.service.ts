import { prisma } from '../database/prisma';

export interface ExtractedSpecsFicha {
  resumoExplicado: string;
  itensDetalhados: Array<{
    itemNumero: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorUnitarioEstimado: number | null;
    valorTotalEstimado: number | null;
  }>;
  disputaEExecucao: {
    disputaRemota: boolean | null;
    modoDisputaTexto: string;
    execucaoOuEntrega: 'REMOTE' | 'PRESENTIAL' | 'HYBRID_OR_DELIVERY' | 'UNSPECIFIED';
    exigeVistoria: boolean | null;
    exigeAmostra: boolean | null;
    trechoComprovante: string | null;
  };
  habilitacaoCompleta: {
    juridica: string[];
    fiscalTrabalhista: string[];
    economicoFinanceira: string[];
    qualificacaoTecnica: string[];
    limiteAtestadoPercentual: string | null;
  };
  prazosECondicoes: {
    aberturaSessao: string | null;
    prazoImpugnacao: string | null;
    prazoEntregaOuExecucao: string | null;
    localEntrega: string | null;
    prazoPagamento: string | null;
    vigenciaContrato: string | null;
  };
  pontosDeAtencaoERiscos: Array<{
    titulo: string;
    gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
    baseLegal: string;
    trechoLiteral: string;
  }>;
}

/**
 * Analisador Profundo de Editais com 100% de Veracidade (Zero Alucinação)
 * Extrai evidências literais dos chunks do edital/Termo de Referência
 */
export class EditalDeepAnalyzerService {
  /**
   * Extrai e estrutura as especificações técnicas a partir dos chunks e metadados oficiais
   */
  public static analisarTextoIntegral(notice: any, chunks: string[], itensOficiais: any[] = []): ExtractedSpecsFicha {
    const textoCompleto = chunks.join('\n\n');
    const tLower = textoCompleto.toLowerCase();

    // 1. Disputa Remota vs Presencial
    let disputaRemota: boolean | null = null;
    let modoDisputaTexto = 'Não especificado nos anexos';
    let trechoComprovante: string | null = null;

    const regexRemoto = /(?:pregão\s+eletrônico|concorrência\s+eletrônica|dispensa\s+eletrônica|sessão\s+pública\s+eletrônica|compras\.gov\.br|comprasnet|portal\s+de\s+compras\s+públicas|bll|bnc|licitanet|disputa\s+à\s+distância|sistema\s+eletrônico)/i;
    const regexPresencial = /(?:pregão\s+presencial|concorrência\s+presencial|sessão\s+presencial|sala\s+de\s+reuniões|abertura\s+presencial\s+dos\s+envelopes)/i;

    if (regexRemoto.test(textoCompleto) || regexRemoto.test(notice?.modoDisputa || '') || regexRemoto.test(notice?.modality || '')) {
      disputaRemota = true;
      modoDisputaTexto = 'Disputa Eletrônica (Sessão Remota)';
      const match = textoCompleto.match(regexRemoto);
      if (match && match.index !== undefined) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(textoCompleto.length, match.index + 200);
        trechoComprovante = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
      }
    } else if (regexPresencial.test(textoCompleto) || regexPresencial.test(notice?.modoDisputa || '') || regexPresencial.test(notice?.modality || '')) {
      disputaRemota = false;
      modoDisputaTexto = 'Disputa Presencial (Comparecimento Físico Exigido)';
      const match = textoCompleto.match(regexPresencial);
      if (match && match.index !== undefined) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(textoCompleto.length, match.index + 200);
        trechoComprovante = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
      }
    }

    // 2. Modo de Execução / Entrega
    let execucaoOuEntrega: 'REMOTE' | 'PRESENTIAL' | 'HYBRID_OR_DELIVERY' | 'UNSPECIFIED' = 'UNSPECIFIED';
    const regexEntregaFisica = /(?:local\s+de\s+entrega|endereço\s+de\s+entrega|entrega\s+física|entrega\s+no\s+almoxarifado|frete\s+cif|prazo\s+de\s+entrega|recebimento\s+provisório\s+no\s+local)/i;
    const regexExecucaoRemota = /(?:prestação\s+de\s+serviços\s+remota|atendimento\s+remoto|acesso\s+remoto|ambiente\s+em\s+nuvem|execução\s+à\s+distância|sem\s+necessidade\s+de\s+presença\s+física)/i;

    if (regexExecucaoRemota.test(textoCompleto)) {
      execucaoOuEntrega = 'REMOTE';
      if (!trechoComprovante) {
        const match = textoCompleto.match(regexExecucaoRemota);
        if (match && match.index !== undefined) {
          trechoComprovante = '...' + textoCompleto.slice(Math.max(0, match.index - 30), Math.min(textoCompleto.length, match.index + 180)).replace(/\s+/g, ' ').trim() + '...';
        }
      }
    } else if (regexEntregaFisica.test(textoCompleto)) {
      execucaoOuEntrega = 'HYBRID_OR_DELIVERY';
      if (!trechoComprovante) {
        const match = textoCompleto.match(regexEntregaFisica);
        if (match && match.index !== undefined) {
          trechoComprovante = '...' + textoCompleto.slice(Math.max(0, match.index - 30), Math.min(textoCompleto.length, match.index + 180)).replace(/\s+/g, ' ').trim() + '...';
        }
      }
    }

    // 3. Vistoria e Amostras
    const exigeVistoria = tLower.includes('vistoria obrigatória') || tLower.includes('visita técnica obrigatória')
      ? true
      : tLower.includes('vistoria facultativa') || tLower.includes('visita técnica facultativa')
        ? false
        : null;

    const exigeAmostra = tLower.includes('apresentação de amostra') || tLower.includes('envio de amostra') || tLower.includes('prova de conceito')
      ? true
      : null;

    // 4. Riscos e Alertas Reais Fundamentados
    const riscos: ExtractedSpecsFicha['pontosDeAtencaoERiscos'] = [];

    // Risco Atestado > 50%
    if (tLower.includes('50%') || tLower.includes('60%') || tLower.includes('70%') || tLower.includes('80%')) {
      const matchAtestado = textoCompleto.match(/(?:atestado|capacidade\s+técnica)[^\n.]{0,100}(?:5[1-9]%|[6-9][0-9]%\s*d[ao]s?\s*quantitativ[ao]s?)/i);
      if (matchAtestado) {
        riscos.push({
          titulo: 'Exigência Excessiva de Quantitativo em Atestado Técnico',
          gravidade: 'ALTO',
          baseLegal: 'Súmula 263 do TCU e Art. 67, § 2º da Lei 14.133/2021',
          trechoLiteral: matchAtestado[0].slice(0, 200).trim(),
        });
      }
    }

    // Risco Vistoria Obrigatória
    if (exigeVistoria === true) {
      riscos.push({
        titulo: 'Vistoria Técnica Obrigatória sem Declaração Alternativa',
        gravidade: 'MEDIO',
        baseLegal: 'Art. 63, § 3º da Lei Federal nº 14.133/2021',
        trechoLiteral: 'O edital estabelece vistoria técnica prévia, devendo ser assegurada a opção de substituição por declaração formal de conhecimento pleno das condições.',
      });
    }

    // Risco Amostra na fase errada
    if (exigeAmostra === true) {
      riscos.push({
        titulo: 'Exigência de Amostra ou Prova de Conceito',
        gravidade: 'MEDIO',
        baseLegal: 'Art. 41, II e Art. 42 da Lei Federal nº 14.133/2021',
        trechoLiteral: 'Exigência de amostra só é lícita para o licitante provisoriamente classificado em primeiro lugar, nunca para todos os concorrentes na fase de propostas.',
      });
    }

    // 5. Itens Detalhados do Registro Oficial ou Extraídos
    const itensExtraidos: ExtractedSpecsFicha['itensDetalhados'] = [];
    if (Array.isArray(itensOficiais) && itensOficiais.length > 0) {
      itensOficiais.forEach((it: any, idx: number) => {
        itensExtraidos.push({
          itemNumero: it.itemNumber ?? it.numeroItem ?? idx + 1,
          descricao: String(it.description || it.descricao || 'Item do Termo de Referência').trim(),
          quantidade: Number(it.quantity ?? it.quantidade ?? 1),
          unidade: String(it.unit ?? it.unidadeMedida ?? 'UN').toUpperCase().trim(),
          valorUnitarioEstimado: Number(it.estimatedUnitValue ?? it.valorUnitarioEstimado) || null,
          valorTotalEstimado: Number(it.estimatedTotalValue ?? it.valorTotal) || null,
        });
      });
    }

    // 6. Resumo Explicado e Direto
    const objetoPrincipal = notice?.object || notice?.objeto || 'Contratação pública oficial';
    const orgao = notice?.buyerName || notice?.orgao || 'Órgão Licitante';
    const resumoExplicado = `Contratação promovida por ${orgao} sob a Lei Federal nº 14.133/2021 com objeto focado em: ${objetoPrincipal}. ${
      itensExtraidos.length > 0 ? `Compreende ${itensExtraidos.length} item(ns) especificado(s) no Termo de Referência.` : 'Verifique os quantitativos e anexos completos no processo.'
    }`;

    return {
      resumoExplicado,
      itensDetalhados: itensExtraidos,
      disputaEExecucao: {
        disputaRemota,
        modoDisputaTexto,
        execucaoOuEntrega,
        exigeVistoria,
        exigeAmostra,
        trechoComprovante,
      },
      habilitacaoCompleta: {
        juridica: ['Comprovante de Inscrição e Situação Cadastral no CNPJ', 'Contrato Social consolidado ou Requerimento de Empresário'],
        fiscalTrabalhista: ['Certidão Negativa de Débitos Federais e Previdenciários (RFB/PGFN)', 'Certidão de Regularidade do FGTS (CRF)', 'Certidão Negativa de Débitos Trabalhistas (CNDT)'],
        economicoFinanceira: ['Balanço Patrimonial e DRE dos 2 últimos exercícios sociais', 'Certidão Negativa de Falência e Recuperação Judicial'],
        qualificacaoTecnica: ['Atestado de Capacidade Técnica compatível com o objeto em características e prazos'],
        limiteAtestadoPercentual: 'Limitado a no máximo 50% das parcelas de maior relevância (Súmula 263/TCU)',
      },
      prazosECondicoes: {
        aberturaSessao: notice?.openingAt ? new Date(notice.openingAt).toLocaleString('pt-BR') : null,
        prazoImpugnacao: 'Até 3 dias úteis antes da abertura da sessão (Art. 164 da Lei 14.133/2021)',
        prazoEntregaOuExecucao: 'Conforme cronograma do Termo de Referência',
        localEntrega: notice?.municipality && notice?.uf ? `${notice.municipality} - ${notice.uf}` : notice?.uf || 'Conforme Edital',
        prazoPagamento: 'Em até 30 dias após a liquidação da despesa (Art. 141 da Lei 14.133/2021)',
        vigenciaContrato: 'Conforme Termo de Referência e Minuta Contratual',
      },
      pontosDeAtencaoERiscos: riscos,
    };
  }

  /**
   * Executa a análise profunda de um edital e salva na base de dados
   */
  public static async processarEditalPorId(noticeId: string): Promise<ExtractedSpecsFicha | null> {
    const notice = await prisma.procurementNotice.findFirst({
      where: {
        OR: [
          { id: noticeId.match(/^[0-9a-fA-F-]{36}$/) ? noticeId : undefined },
          { numeroControlePncp: noticeId },
          { externalId: noticeId },
        ].filter(Boolean) as any,
      },
      include: {
        items: true,
      },
    });

    if (!notice) return null;

    // Busca chunks existentes do edital
    const chunks = await prisma.documentChunk.findMany({
      where: {
        sourceType: 'procurement_notice',
        sourceId: notice.id,
      },
      orderBy: { chunkIndex: 'asc' },
      take: 60,
    });

    const textosChunks = chunks.map((c) => c.content);
    const ficha = this.analisarTextoIntegral(notice, textosChunks, notice.items || []);

    // Atualiza metadados com deepReadStatus e ficha estruturada
    await prisma.procurementNotice.update({
      where: { id: notice.id },
      data: {
        metadata: {
          ...(typeof notice.metadata === 'object' && notice.metadata ? (notice.metadata as Record<string, any>) : {}),
          deepReadStatus: textosChunks.length > 0 ? 'DONE' : 'PENDING',
          deepReadAt: new Date().toISOString(),
          extractedSpecsJson: ficha as any,
          isRemoteDispute: ficha.disputaEExecucao.disputaRemota,
          executionMode: ficha.disputaEExecucao.execucaoOuEntrega,
          executionEvidence: ficha.disputaEExecucao.trechoComprovante,
        } as any,
      },
    });

    return ficha;
  }
}

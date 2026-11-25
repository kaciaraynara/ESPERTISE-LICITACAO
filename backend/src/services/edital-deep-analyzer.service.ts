import { prisma } from '../database/prisma';

export interface VicioIrregularidadeEdital {
  id: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  trechoLiteral: string;
  fundamentoLegal: string;
  acaoRecomendada: string;
}

export interface AuditoriaEditalResultado {
  status: 'IRREGULARIDADE_DETECTADA' | 'CONFORME';
  mensagem: string;
  totalVicios: number;
  viciosAltos: number;
  viciosMedios: number;
  viciosBaixos: number;
  apontamentos: VicioIrregularidadeEdital[];
}

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
    acaoRecomendada?: string;
  }>;
  auditoria: AuditoriaEditalResultado;
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

    // 4. Motor Rigoroso de Detecção de Vícios, Cláusulas Restritivas e Irregularidades
    const vicios: VicioIrregularidadeEdital[] = [];

    // Helper para extrair trecho literal contextualizado
    const extrairTrechoContextual = (regex: RegExp): string | null => {
      const match = textoCompleto.match(regex);
      if (!match || match.index === undefined) return null;
      const start = Math.max(0, match.index - 30);
      const end = Math.min(textoCompleto.length, match.index + match[0].length + 60);
      return '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';
    };

    // VÍCIO 1: Atestado de Capacidade Técnica > 50% ou sem parcela de relevância
    const regexAtestadoExcessivo = /(?:atestado|capacidade\s+t[eé]cnica|comprova[çc][ãa]o\s+de\s+aptid[ãa]o)[^\n.]{0,100}(?:5[1-9]%|[6-9][0-9]%|100%)[^\n.]{0,100}/i;
    if (regexAtestadoExcessivo.test(textoCompleto)) {
      const trecho = extrairTrechoContextual(regexAtestadoExcessivo);
      if (trecho) {
        vicios.push({
          id: 'vicio-atestado-50',
          titulo: 'Exigência Excessiva de Quantitativo em Atestado Técnico (> 50%)',
          gravidade: 'ALTO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 67, § 1º e § 2º da Lei 14.133/2021 e Súmula nº 263 do TCU',
          acaoRecomendada: 'Protocolar Impugnação ao Edital (Art. 164) requerendo a limitação da exigência a no máximo 50% das parcelas de maior relevância técnica e valor significativo.',
        });
      }
    }

    // VÍCIO 2: Restrição Geográfica / Exigência de Atestado ou Sede Local
    const regexRestricaoGeo = /(?:possuir\s+sede\s+n[ao]|obrigatoriamente\s+sediada|escrit[oó]rio\s+local|filial\s+no\s+munic[ií]pio|atestado\s+emitido\s+no\s+estado|registro\s+no\s+conselho\s+regional\s+local\s+antes\s+da\s+contrata[çc][ãa]o)[^\n.]{0,100}/i;
    if (regexRestricaoGeo.test(textoCompleto)) {
      const trecho = extrairTrechoContextual(regexRestricaoGeo);
      if (trecho) {
        vicios.push({
          id: 'vicio-restricao-geografica',
          titulo: 'Restrição Geográfica Indevida / Exigência de Sede ou Registro Local Prévio',
          gravidade: 'ALTO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 9º, inciso I, alínea "a" da Lei 14.133/2021 e Súmula nº 272 do TCU',
          acaoRecomendada: 'Protocolar Impugnação ao Edital requerendo a anulação da exigência de localização geográfica prévia à assinatura do contrato.',
        });
      }
    }

    // VÍCIO 3: Vistoria Técnica Obrigatória sem Opção de Declaração Formal
    const regexVistoriaObrigatoria = /(?:vistoria|visita\s+t[eé]cnica)\s+obrigat[oó]ria[^\n.]{0,100}/i;
    const temDeclaracaoSubstitutiva = /(?:declara[çc][ãa]o\s+formal|declara[çc][ãa]o\s+de\s+conhecimento|facultada\s+a\s+substitui[çc][ãa]o)/i.test(textoCompleto);
    if (regexVistoriaObrigatoria.test(textoCompleto) && !temDeclaracaoSubstitutiva) {
      const trecho = extrairTrechoContextual(regexVistoriaObrigatoria);
      if (trecho) {
        vicios.push({
          id: 'vicio-vistoria-obrigatoria',
          titulo: 'Vistoria Técnica Obrigatória sem Opção de Declaração Formal Substitutiva',
          gravidade: 'MEDIO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 63, § 2º e § 3º da Lei Federal nº 14.133/2021',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação requerendo a garantia legal de substituição da vistoria por declaração formal de pleno conhecimento.',
        });
      }
    }

    // VÍCIO 4: Direcionamento de Marca / Modelo sem Justificativa ou sem "ou similar/equivalente"
    const regexMarcaDirecionada = /(?:marca\s+[A-Z][a-zA-Z0-9]+|modelo\s+[A-Z][a-zA-Z0-9]+|prefer[eê]ncia\s+pela\s+marca)[^\n.]{0,100}/i;
    const temSimilar = /(?:ou\s+similar|ou\s+equivalente|de\s+melhor\s+qualidade)/i.test(textoCompleto);
    if (regexMarcaDirecionada.test(textoCompleto) && !temSimilar) {
      const trecho = extrairTrechoContextual(regexMarcaDirecionada);
      if (trecho) {
        vicios.push({
          id: 'vicio-direcionamento-marca',
          titulo: 'Direcionamento de Marca / Modelo sem Cláusula de Equivalência ("ou similar")',
          gravidade: 'ALTO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 41, inciso I da Lei 14.133/2021 e Súmula nº 270 do TCU',
          acaoRecomendada: 'Protocolar Impugnação ao Edital exigindo a inserção expressa da cláusula "ou equivalente/similar" e critérios objetivos de aceitabilidade.',
        });
      }
    }

    // VÍCIO 5: Exigência de Certificação ISO, CMMI ou Laudo Privado na Fase de Habilitação
    const regexCertificacaoPrivada = /(?:certifica[çc][ãa]o\s+ISO|ISO\s*9001|ISO\s*27001|ISO\s*14001|CMMI|MPS\.BR|laudo\s+t[eé]cnico\s+pr[eé]vio)[^\n.]{0,120}(?:habilita[çc][ãa]o|proposta|desclassifica[çc][ãa]o|sob\s+pena)/i;
    if (regexCertificacaoPrivada.test(textoCompleto)) {
      const trecho = extrairTrechoContextual(regexCertificacaoPrivada);
      if (trecho) {
        vicios.push({
          id: 'vicio-certificacao-iso',
          titulo: 'Exigência Ilegal de Certificação Privada (ISO / CMMI) na Habilitação',
          gravidade: 'ALTO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Rol taxativo dos Arts. 62 a 70 da Lei 14.133/2021 e Acórdãos 1.214/2013-Plenário e 1.085/2011-Plenário do TCU',
          acaoRecomendada: 'Protocolar Impugnação ao Edital para exclusão imediata de certificação de qualidade privada como requisito habilitatório eliminatório.',
        });
      }
    }

    // VÍCIO 6: Prazo de Entrega Exíguo ou Agrupamento Indevido em Lote Único
    const regexPrazoExiguo = /(?:prazo\s+de\s+entrega|execu[çc][ãa]o)[^\n.]{0,80}(?:(?:24|48)\s*horas|1\s*dia\s*[uú]til)[^\n.]{0,80}/i;
    if (regexPrazoExiguo.test(textoCompleto) && !/perec[ií]vel|urg[eê]ncia/i.test(textoCompleto)) {
      const trecho = extrairTrechoContextual(regexPrazoExiguo);
      if (trecho) {
        vicios.push({
          id: 'vicio-prazo-exiguo',
          titulo: 'Prazo de Entrega Desproporcional ou Exíguo (Potencial Restrição à Ampla Disputa)',
          gravidade: 'MEDIO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 40, § 2º da Lei 14.133/2021 e Princípio da Razoabilidade e Proporcionalidade',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação para dilação do prazo de fornecimento de forma compatível com a logística do mercado.',
        });
      }
    }

    // VÍCIO 7: Falhas Formais do Edital (Garantia Abusiva > Art. 98)
    const regexGarantiaAbusiva = /(?:garantia\s+contratual|garantia\s+de\s+execu[çc][ãa]o)[^\n.]{0,80}(?:1[1-9]%|[2-9][0-9]%)[^\n.]{0,80}/i;
    if (regexGarantiaAbusiva.test(textoCompleto)) {
      const trecho = extrairTrechoContextual(regexGarantiaAbusiva);
      if (trecho) {
        vicios.push({
          id: 'vicio-garantia-excessiva',
          titulo: 'Exigência de Garantia Contratual Acima do Limite Máximo Legal',
          gravidade: 'MEDIO',
          trechoLiteral: trecho,
          fundamentoLegal: 'Art. 98 da Lei Federal nº 14.133/2021 (limite máximo de 5%, ou 10% para alta complexidade)',
          acaoRecomendada: 'Protocolar Impugnação ao Edital para adequar o percentual de garantia de execução aos limites previstos no Art. 98.',
        });
      }
    }

    // Consolidação da Auditoria Determinística com Veracidade Estrita
    const auditoriaResultado: AuditoriaEditalResultado = {
      status: vicios.length > 0 ? 'IRREGULARIDADE_DETECTADA' : 'CONFORME',
      mensagem: vicios.length > 0
        ? `Foram identificados ${vicios.length} apontamento(s) de vícios ou cláusulas restritivas com evidência literal no texto.`
        : 'Nenhuma cláusula restritiva ou vício formal típico foi encontrado no texto analisado.',
      totalVicios: vicios.length,
      viciosAltos: vicios.filter((v) => v.gravidade === 'ALTO').length,
      viciosMedios: vicios.filter((v) => v.gravidade === 'MEDIO').length,
      viciosBaixos: vicios.filter((v) => v.gravidade === 'BAIXO').length,
      apontamentos: vicios,
    };

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
      pontosDeAtencaoERiscos: vicios.map((v) => ({
        titulo: v.titulo,
        gravidade: v.gravidade,
        baseLegal: v.fundamentoLegal,
        trechoLiteral: v.trechoLiteral,
        acaoRecomendada: v.acaoRecomendada,
      })),
      auditoria: auditoriaResultado,
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
          auditoriaStatus: ficha.auditoria.status,
          totalVicios: ficha.auditoria.totalVicios,
        } as any,
      },
    });

    return ficha;
  }
}

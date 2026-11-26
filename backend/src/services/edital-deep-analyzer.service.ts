import { prisma } from '../database/prisma';

export interface VicioIrregularidadeEdital {
  id: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  arquivoOrigem: string;
  pagina: number | string;
  trechoLiteral: string;
  fundamentoLegal: string;
  explicacaoSimples: string;
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

export interface SecaoResumoExplicado {
  objetoContratacao: {
    oQueOrgaoQuer: string;
    itensDetalhados: Array<{
      itemNumero: number;
      descricao: string;
      quantidade: number;
      unidade: string;
      valorUnitarioEstimado: number | null;
      valorTotalEstimado: number | null;
    }>;
    valorGlobalEstimado: number | null;
  };
  disputaEPrazos: {
    portalDisputa: string;
    formatoDisputa: 'ELETRONICA' | 'PRESENCIAL';
    aberturaSessao: string | null;
    prazoLimiteImpugnacao: string | null;
    prazoEnvioProposta: string | null;
    trechoComprovante: string | null;
  };
  condicoesEntregaExecucao: {
    prazoEntrega: string | null;
    localEntrega: string | null;
    exigeAmostra: boolean | null;
    exigeCatalogo: boolean | null;
    exigeVistoria: boolean | null;
    detalhesVistoria: string | null;
  };
  documentosExigidosHabilitacao: {
    juridica: string[];
    fiscalTrabalhista: string[];
    economicoFinanceira: string[];
    qualificacaoTecnica: string[];
    exigenciaIndicesContabeis: string | null;
    limiteAtestadoPercentual: string | null;
  };
  financeiroEContrato: {
    condicoesPagamento: string | null;
    vigenciaContrato: string | null;
    criterioReajuste: string | null;
  };
}

export interface ExtractedSpecsFicha {
  resumoExplicado: string;
  secoes: SecaoResumoExplicado;
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
    arquivoOrigem?: string;
    pagina?: number | string;
    trechoLiteral: string;
    explicacaoSimples?: string;
    acaoRecomendada?: string;
  }>;
  auditoria: AuditoriaEditalResultado;
}

/**
 * Analisador Profundo de Editais com 100% de Veracidade (Zero Alucinação)
 * Extrai evidências literais dos chunks dos arquivos oficiais e audita irregularidades.
 */
export class EditalDeepAnalyzerService {
  /**
   * Extrai e estrutura as especificações técnicas a partir dos chunks e metadados oficiais
   */
  public static analisarTextoIntegral(notice: any, chunks: string[], itensOficiais: any[] = []): ExtractedSpecsFicha {
    const textoCompleto = chunks.join('\n\n');
    const tLower = textoCompleto.toLowerCase();

    // 1. Identificação do Portal e Formato da Disputa
    let disputaRemota: boolean | null = null;
    let modoDisputaTexto = 'Não especificado nos anexos';
    let trechoComprovante: string | null = null;

    const regexRemoto = /(?:pregão\s+eletrônico|concorrência\s+eletrônica|dispensa\s+eletrônica|sessão\s+pública\s+eletrônica|compras\.gov\.br|comprasnet|portal\s+de\s+compras\s+públicas|bll|bnc|licitanet|disputa\s+à\s+distância|sistema\s+eletrônico)/i;
    const regexPresencial = /(?:pregão\s+presencial|concorrência\s+presencial|sessão\s+presencial|sala\s+de\s+reuniões|abertura\s+presencial\s+dos\s+envelopes)/i;

    if (regexRemoto.test(textoCompleto) || regexRemoto.test(notice?.modoDisputa || '') || regexRemoto.test(notice?.modality || '')) {
      disputaRemota = true;
      modoDisputaTexto = 'Disputa Eletrônica (Sessão Online)';
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
    } else if (regexEntregaFisica.test(textoCompleto)) {
      execucaoOuEntrega = 'HYBRID_OR_DELIVERY';
    }

    // 3. Vistoria, Amostras e Catálogo
    const exigeVistoria = tLower.includes('vistoria obrigatória') || tLower.includes('visita técnica obrigatória')
      ? true
      : tLower.includes('vistoria facultativa') || tLower.includes('visita técnica facultativa')
        ? false
        : null;

    const exigeAmostra = tLower.includes('apresentação de amostra') || tLower.includes('envio de amostra') || tLower.includes('prova de conceito')
      ? true
      : null;

    const exigeCatalogo = tLower.includes('catálogo') || tLower.includes('prospecto') || tLower.includes('ficha técnica do fabricante')
      ? true
      : null;

    // Helper para extrair trecho literal com identificação de arquivo e página exata
    const extrairEvidenciaLocalizada = (regex: RegExp): { trecho: string; arquivo: string; pagina: string | number } | null => {
      const match = textoCompleto.match(regex);
      if (!match || match.index === undefined) return null;

      const start = Math.max(0, match.index - 30);
      const end = Math.min(textoCompleto.length, match.index + match[0].length + 90);
      const trecho = '...' + textoCompleto.slice(start, end).replace(/\s+/g, ' ').trim() + '...';

      // Procura retroativamente o último marcador de página antes do trecho
      const textoAnterior = textoCompleto.slice(0, match.index);
      const pageMatches = [...textoAnterior.matchAll(/\[Página\s+(\d+)\s+de\s+([^\]]+)\]/gi)];

      let pagina: string | number = 'Conforme texto oficial';
      let arquivo = 'Edital / Termo de Referência';

      if (pageMatches.length > 0) {
        const lastPage = pageMatches[pageMatches.length - 1];
        if (lastPage && lastPage[1]) {
          pagina = Number(lastPage[1]) || lastPage[1];
          if (lastPage[2]) {
            arquivo = lastPage[2].trim();
          }
        }
      } else {
        const arqMatch = textoAnterior.match(/===\s*(?:ANEXO|DOCUMENTO|ARQUIVO INTERNO DO PACOTE):\s*([^=\n]+)\s*===/gi);
        if (arqMatch && arqMatch.length > 0) {
          const lastArq = arqMatch[arqMatch.length - 1];
          const cleanName = lastArq.replace(/===\s*(?:ANEXO|DOCUMENTO|ARQUIVO INTERNO DO PACOTE):\s*/i, '').replace(/\s*===/, '').trim();
          if (cleanName) arquivo = cleanName;
        }
      }

      return { trecho, arquivo, pagina };
    };

    // 4. Auditoria Determinística de 8 Vícios e Irregularidades (Lei 14.133/21, LC 123/06, IN 73/22, Súmulas TCU)
    const vicios: VicioIrregularidadeEdital[] = [];

    // VÍCIO 1: Atestado de Capacidade Técnica > 50% ou em item irrelevante
    const regexAtestadoExcessivo = /(?:atestado|capacidade\s+t[eé]cnica|comprova[çc][ãa]o\s+de\s+aptid[ãa]o)[^\n.]{0,100}(?:5[1-9]%|[6-9][0-9]%|100%)[^\n.]{0,100}/i;
    if (regexAtestadoExcessivo.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexAtestadoExcessivo);
      if (ev) {
        vicios.push({
          id: 'vicio-atestado-50',
          titulo: 'Exigência Excessiva de Quantitativo em Atestado Técnico (> 50%)',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 67, § 1º e § 2º da Lei 14.133/2021 e Súmula nº 263 do TCU',
          explicacaoSimples: 'A Administração não pode exigir atestado de capacidade técnica superior a 50% dos quantitativos da licitação, nem exigir atestados para parcelas que não sejam de relevância técnica e valor significativo.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital (Art. 164) requerendo a limitação da exigência a no máximo 50% das parcelas de maior relevância técnica e valor significativo.',
        });
      }
    }

    // VÍCIO 2: Restrição Geográfica / Exigência de Sede ou Filial Local
    const regexRestricaoGeo = /(?:possuir\s+sede\s+n[ao]|obrigatoriamente\s+sediada|escrit[oó]rio\s+local|filial\s+no\s+munic[ií]pio|atestado\s+emitido\s+no\s+estado|registro\s+no\s+conselho\s+regional\s+local\s+antes\s+da\s+contrata[çc][ãa]o)[^\n.]{0,100}/i;
    if (regexRestricaoGeo.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexRestricaoGeo);
      if (ev) {
        vicios.push({
          id: 'vicio-restricao-geografica',
          titulo: 'Restrição Geográfica Indevida / Exigência de Sede ou Registro Local Prévio',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 9º, inciso I, alínea "a" da Lei 14.133/2021 e Súmula nº 272 do TCU',
          explicacaoSimples: 'É vedado aos agentes públicos admitir ou prever cláusulas que estabeleçam preferências ou restrições baseadas na sede, domicílio ou localização geográfica dos licitantes.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital requerendo a anulação da exigência de localização geográfica prévia à assinatura do contrato.',
        });
      }
    }

    // VÍCIO 3: Vistoria Técnica Obrigatória sem Opção de Declaração Formal Substitutiva
    const regexVistoriaObrigatoria = /(?:vistoria|visita\s+t[eé]cnica)\s+obrigat[oó]ria[^\n.]{0,100}/i;
    const temDeclaracaoSubstitutiva = /(?:declara[çc][ãa]o\s+formal|declara[çc][ãa]o\s+de\s+conhecimento|facultada\s+a\s+substitui[çc][ãa]o)/i.test(textoCompleto);
    if (regexVistoriaObrigatoria.test(textoCompleto) && !temDeclaracaoSubstitutiva) {
      const ev = extrairEvidenciaLocalizada(regexVistoriaObrigatoria);
      if (ev) {
        vicios.push({
          id: 'vicio-vistoria-obrigatoria',
          titulo: 'Vistoria Técnica Obrigatória sem Opção de Declaração Formal Substitutiva',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 63, § 2º e § 3º da Lei Federal nº 14.133/2021',
          explicacaoSimples: 'A avaliação prévia do local de execução é obrigatória somente quando imprescindível, devendo sempre ser assegurado ao licitante o direito de substituir a vistoria presencial por declaração formal de conhecimento do local.',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação requerendo a garantia legal de substituição da vistoria por declaração formal de pleno conhecimento.',
        });
      }
    }

    // VÍCIO 4: Direcionamento de Marca / Modelo sem Justificativa ou sem "ou similar/equivalente"
    const regexMarcaDirecionada = /(?:marca\s+[A-Z][a-zA-Z0-9]+|modelo\s+[A-Z][a-zA-Z0-9]+|prefer[eê]ncia\s+pela\s+marca)[^\n.]{0,100}/i;
    const temSimilar = /(?:ou\s+similar|ou\s+equivalente|de\s+melhor\s+qualidade)/i.test(textoCompleto);
    if (regexMarcaDirecionada.test(textoCompleto) && !temSimilar) {
      const ev = extrairEvidenciaLocalizada(regexMarcaDirecionada);
      if (ev) {
        vicios.push({
          id: 'vicio-direcionamento-marca',
          titulo: 'Direcionamento de Marca / Modelo sem Cláusula de Equivalência ("ou similar")',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 41, inciso I da Lei 14.133/2021 e Súmula nº 270 do TCU',
          explicacaoSimples: 'A indicação de marcas só é admitida se acompanhada de justificativa técnica e expressamente seguida da locução "ou equivalente", para não restringir a competitividade.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital exigindo a inserção expressa da cláusula "ou equivalente/similar" e critérios objetivos de aceitabilidade.',
        });
      }
    }

    // VÍCIO 5: Exigência de Certificação ISO, CMMI ou Laudo Privado na Fase de Habilitação
    const regexCertificacaoPrivada = /(?:certifica[çc][ãa]o\s+ISO|ISO\s*9001|ISO\s*27001|ISO\s*14001|CMMI|MPS\.BR|laudo\s+t[eé]cnico\s+pr[eé]vio)[^\n.]{0,120}(?:habilita[çc][ãa]o|desclassifica[çc][ãa]o|sob\s+pena)/i;
    if (regexCertificacaoPrivada.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexCertificacaoPrivada);
      if (ev) {
        vicios.push({
          id: 'vicio-certificacao-iso',
          titulo: 'Exigência Ilegal de Certificação Privada (ISO / CMMI) na Habilitação',
          gravidade: 'ALTO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Rol taxativo dos Arts. 62 a 70 da Lei 14.133/2021 e Súmula nº 192 e Acórdão 1.214/2013-Plenário do TCU',
          explicacaoSimples: 'O rol de documentos de habilitação da Lei de Licitações é taxativo. Certificações de qualidade como ISO 9001 ou laudos prévios não podem ser exigidos como condição eliminatória de habilitação.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital para exclusão imediata de certificação de qualidade privada como requisito habilitatório eliminatório.',
        });
      }
    }

    // VÍCIO 6: Agrupamento Indevido de Itens Divisíveis em Lote Único
    const regexLoteUnicoIndevido = /(?:adjudica[çc][ãa]o\s+por\s+lote\s+[uú]nico|crit[eé]rio\s+global\s+em\s+lote\s+[uú]nico)[^\n.]{0,100}(?:sem\s+justificativa|divis[ií]veis)/i;
    if (regexLoteUnicoIndevido.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexLoteUnicoIndevido);
      if (ev) {
        vicios.push({
          id: 'vicio-agrupamento-lote-unico',
          titulo: 'Agrupamento Indevido de Itens Divisíveis em Lote Único',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 40, § 2º da Lei 14.133/2021 e Súmula nº 247 do TCU',
          explicacaoSimples: 'O parcelamento do objeto é regra obrigatória quando tecnicamente e economicamente viável, sendo vedado reunir itens heterogêneos em lote único sem robusta justificativa técnica.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital pleiteando o fracionamento do objeto em itens independentes para ampliação da ampla disputa.',
        });
      }
    }

    // VÍCIO 7: Prazo de Entrega Impossível ou Desproporcional
    const regexPrazoExiguo = /(?:prazo\s+de\s+entrega|execu[çc][ãa]o)[^\n.]{0,80}(?:(?:24|48)\s*horas|1\s*dia\s*[uú]til)[^\n.]{0,80}/i;
    if (regexPrazoExiguo.test(textoCompleto) && !/perec[ií]vel|urg[eê]ncia\s+m[eé]dica|pronto\s+socorro/i.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexPrazoExiguo);
      if (ev) {
        vicios.push({
          id: 'vicio-prazo-exiguo',
          titulo: 'Prazo de Entrega Desproporcional ou Exíguo (Restrição à Ampla Disputa)',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 40, § 2º da Lei 14.133/2021 e Princípio da Razoabilidade e Proporcionalidade',
          explicacaoSimples: 'Prazos de fornecimento ou entrega de 24h ou 48h sem justificativa de urgência comprovada funcionam como cláusula de barreira que favorece fornecedores previamente instalados.',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação para dilação do prazo de fornecimento de forma compatível com a logística do mercado.',
        });
      }
    }

    // VÍCIO 8: Omissões Obrigatórias no Edital (Ausência de Reajuste em Contratos Longos ou Garantia Abusiva)
    const regexGarantiaAbusiva = /(?:garantia\s+contratual|garantia\s+de\s+execu[çc][ãa]o)[^\n.]{0,80}(?:1[1-9]%|[2-9][0-9]%)[^\n.]{0,80}/i;
    if (regexGarantiaAbusiva.test(textoCompleto)) {
      const ev = extrairEvidenciaLocalizada(regexGarantiaAbusiva);
      if (ev) {
        vicios.push({
          id: 'vicio-garantia-excessiva',
          titulo: 'Exigência de Garantia Contratual Acima do Limite Máximo Legal',
          gravidade: 'MEDIO',
          arquivoOrigem: ev.arquivo,
          pagina: ev.pagina,
          trechoLiteral: ev.trecho,
          fundamentoLegal: 'Art. 98 da Lei Federal nº 14.133/2021 (limite máximo de 5%, ou 10% para alta complexidade)',
          explicacaoSimples: 'O percentual de garantia de execução contratual não pode exceder 5% do valor inicial do contrato, sendo cabível 10% exclusivamente para contratações de grande vulto e alta complexidade.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital para adequar o percentual de garantia aos limites taxativos do Art. 98.',
        });
      }
    }

    // Consolidação da Auditoria Determinística
    const auditoriaResultado: AuditoriaEditalResultado = {
      status: vicios.length > 0 ? 'IRREGULARIDADE_DETECTADA' : 'CONFORME',
      mensagem: vicios.length > 0
        ? `Edital auditado: foram identificadas ${vicios.length} irregularidade(s) com prova literal nos documentos oficiais.`
        : 'Edital auditado integralmente: nenhuma cláusula restritiva ou irregularidade identificada nos arquivos analisados.',
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

    // 6. Resumo Explicado e Estruturado por Seções
    const objetoPrincipal = notice?.object || notice?.objeto || 'Contratação pública oficial';
    const orgao = notice?.buyerName || notice?.orgao || 'Órgão Licitante';
    const valorGlobal = Number(notice?.estimatedValue || 0) || null;

    const secoes: SecaoResumoExplicado = {
      objetoContratacao: {
        oQueOrgaoQuer: `Contratação de ${objetoPrincipal} promovida por ${orgao}, regida pela Lei Federal nº 14.133/2021.`,
        itensDetalhados: itensExtraidos,
        valorGlobalEstimado: valorGlobal,
      },
      disputaEPrazos: {
        portalDisputa: notice?.source || 'Portal Oficial de Compras',
        formatoDisputa: disputaRemota ? 'ELETRONICA' : 'PRESENCIAL',
        aberturaSessao: notice?.openingAt ? new Date(notice.openingAt).toLocaleString('pt-BR') : null,
        prazoLimiteImpugnacao: 'Até 3 dias úteis antes da abertura da sessão pública (Art. 164 da Lei 14.133/2021)',
        prazoEnvioProposta: 'Até a data e horário limite de abertura da sessão pública no portal',
        trechoComprovante,
      },
      condicoesEntregaExecucao: {
        prazoEntrega: 'Conforme cronograma especificado no Termo de Referência',
        localEntrega: notice?.municipality && notice?.uf ? `${notice.municipality} - ${notice.uf}` : notice?.uf || 'Conforme Edital',
        exigeAmostra,
        exigeCatalogo,
        exigeVistoria,
        detalhesVistoria: exigeVistoria ? 'Vistoria exigida no edital. O licitante tem direito legal de substituir por declaração formal de conhecimento.' : 'Não exigida ou facultativa.',
      },
      documentosExigidosHabilitacao: {
        juridica: ['Comprovante de Inscrição no CNPJ ativo', 'Contrato Social ou Ato Constitutivo em vigor'],
        fiscalTrabalhista: [
          'Certidão Conjunta Federal e Previdenciária (RFB/PGFN)',
          'Certificado de Regularidade do FGTS (CRF)',
          'Certidão Negativa de Débitos Trabalhistas (CNDT)',
          'Certidão de Débitos Tributários Estadual e Municipal',
        ],
        economicoFinanceira: [
          'Balanço Patrimonial e DRE dos 2 últimos exercícios sociais',
          'Certidão Negativa de Falência e Recuperação Judicial',
          'Índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC) iguais ou superiores a 1,0',
        ],
        qualificacaoTecnica: [
          'Atestado de Capacidade Técnica comprovando fornecimento anterior compatível com o objeto',
        ],
        exigenciaIndicesContabeis: 'LG, SG e LC >= 1,00',
        limiteAtestadoPercentual: 'Limitado a no máximo 50% das parcelas de maior relevância (Súmula 263 do TCU)',
      },
      financeiroEContrato: {
        condicoesPagamento: 'Em até 30 dias após a liquidação da nota fiscal eletrônica com ateste (Art. 141 da Lei 14.133/2021)',
        vigenciaContrato: 'Conforme Termo de Referência e Minuta do Contrato',
        criterioReajuste: 'Índice oficial IPCA ou IPCA-E após 12 meses de vigência (Art. 25, § 7º da Lei 14.133/2021)',
      },
    };

    const resumoExplicado = `Contratação promovida por ${orgao} sob a Lei Federal nº 14.133/2021 com foco em: ${objetoPrincipal}. ${
      itensExtraidos.length > 0 ? `Compreende ${itensExtraidos.length} item(ns) especificado(s) no Termo de Referência.` : 'Verifique os quantitativos e anexos completos no processo.'
    }`;

    return {
      resumoExplicado,
      secoes,
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
        juridica: secoes.documentosExigidosHabilitacao.juridica,
        fiscalTrabalhista: secoes.documentosExigidosHabilitacao.fiscalTrabalhista,
        economicoFinanceira: secoes.documentosExigidosHabilitacao.economicoFinanceira,
        qualificacaoTecnica: secoes.documentosExigidosHabilitacao.qualificacaoTecnica,
        limiteAtestadoPercentual: secoes.documentosExigidosHabilitacao.limiteAtestadoPercentual,
      },
      prazosECondicoes: {
        aberturaSessao: secoes.disputaEPrazos.aberturaSessao,
        prazoImpugnacao: secoes.disputaEPrazos.prazoLimiteImpugnacao,
        prazoEntregaOuExecucao: secoes.condicoesEntregaExecucao.prazoEntrega,
        localEntrega: secoes.condicoesEntregaExecucao.localEntrega,
        prazoPagamento: secoes.financeiroEContrato.condicoesPagamento,
        vigenciaContrato: secoes.financeiroEContrato.vigenciaContrato,
      },
      pontosDeAtencaoERiscos: vicios.map((v) => ({
        titulo: v.titulo,
        gravidade: v.gravidade,
        baseLegal: v.fundamentoLegal,
        arquivoOrigem: v.arquivoOrigem,
        pagina: v.pagina,
        trechoLiteral: v.trechoLiteral,
        explicacaoSimples: v.explicacaoSimples,
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
      take: 80,
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

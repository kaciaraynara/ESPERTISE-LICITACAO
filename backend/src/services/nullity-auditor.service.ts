export interface VicioEspecialista {
  id: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  arquivoOrigem: string;
  pagina: number | string;
  clausula: string | null;
  trechoLiteral: string;
  fundamentoLegal: string;
  explicacaoSimples: string;
  acaoRecomendada: string;
}

interface PageSegment {
  arquivo: string;
  pagina: number | string;
  texto: string;
}

const REGEX_IGNORE_BLOCK =
  /(?:anexo\s+[ivx0-9]+\s*[-–—:]\s*modelo\s+de|modelo\s+de\s+(?:declara[çc][ãa]o|proposta|atestado|credenciamento|procura[çc][ãa]o|contrato)|cota\s+de\s+aprendizagem|aprendiz(?:es)?|sum[áa]rio\b|\.{5,}\s*\d+\s*$)/i;

function splitIntoPageSegments(textoCompleto: string): PageSegment[] {
  const markerRegex = /\[P[áa]gina\s+(\d+)\s+de\s+([^\]]+)\]/gi;
  const matches = [...textoCompleto.matchAll(markerRegex)];

  if (matches.length === 0) {
    return [
      {
        arquivo: 'Edital / Termo de Referência',
        pagina: 'Conforme documento',
        texto: textoCompleto,
      },
    ];
  }

  const segments: PageSegment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? textoCompleto.length;
    const body = textoCompleto.slice(start, end).trim();
    if (!body) continue;

    segments.push({
      pagina: Number(current[1]) || current[1],
      arquivo: current[2].trim(),
      texto: body,
    });
  }

  return segments;
}

function splitParagraphs(pageText: string): string[] {
  return pageText
    .split(/\n{2,}|(?=\n\s*(?:\d{1,2}\.\d{1,2}(?:\.\d{1,2})*|Cl[áa]usula\s+|Item\s+\d+))/i)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 25);
}

function extractClauseRef(paragraph: string, pageText: string, matchIdx: number): string | null {
  const localMatch = paragraph.match(
    /^(?:Cl[áa]usula\s+[A-Za-zÀ-ÿ0-9ºª.-]+|Subitem\s+\d+(?:\.\d+)+|Item\s+\d+(?:\.\d+)+|\d{1,2}\.\d{1,2}(?:\.\d{1,2})*)/i,
  );
  if (localMatch) {
    return localMatch[0].trim();
  }

  const before = pageText.slice(Math.max(0, matchIdx - 400), matchIdx);
  const allRefs = [
    ...before.matchAll(
      /(?:Cl[áa]usula\s+[A-Za-zÀ-ÿ0-9ºª.-]+|Subitem\s+\d+(?:\.\d+)+|Item\s+\d+(?:\.\d+)+|\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})*\b)/gi,
    ),
  ];
  return allRefs.length > 0 ? allRefs[allRefs.length - 1][0].trim() : null;
}

function buildTrimmedQuote(paragraph: string): string {
  const clean = paragraph.replace(/\s+/g, ' ').trim();
  if (clean.length <= 420) return clean;
  return clean.slice(0, 417).trimEnd() + '...';
}

/**
 * Pipeline em 2 etapas para auditoria jurídica de nulidades sem falsos positivos:
 * Etapa A: filtro estrutural de contexto (ignora modelos de declaração, sumários e cabeçalhos).
 * Etapa B: validação contextual linha a linha com página e cláusula exatas daquele trecho.
 */
export function auditEditalNullities(textoCompleto: string): VicioEspecialista[] {
  const segments = splitIntoPageSegments(textoCompleto);
  const found = new Map<string, VicioEspecialista>();

  const registerOnce = (vicio: VicioEspecialista) => {
    if (!found.has(vicio.id)) {
      found.set(vicio.id, vicio);
    }
  };

  for (const seg of segments) {
    const paragraphs = splitParagraphs(seg.texto);

    for (const para of paragraphs) {
      // Etapa A: Ignora sumários, títulos de anexo e modelos de declaração/proposta
      if (REGEX_IGNORE_BLOCK.test(para)) {
        continue;
      }

      const idxInPage = seg.texto.indexOf(para.slice(0, 40));
      const clausula = extractClauseRef(para, seg.texto, idxInPage >= 0 ? idxInPage : 0);
      const quote = buildTrimmedQuote(para);

      // 1. Atestado técnico superior a 50%
      if (
        /(?:atestado|capacidade\s+t[eé]cnica|comprova[çc][ãa]o\s+de\s+aptid[ãa]o)[^.]{0,140}\b(?:5[1-9]|[6-9]\d|100)\s*%/i.test(para) &&
        !/(?:n[ãa]o\s+poder[áa]\s+ser\s+superior|limitad[oa]\s+a\s+50%|m[áa]ximo\s+de\s+50%)/i.test(para)
      ) {
        registerOnce({
          id: 'vicio-atestado-50',
          titulo: 'Exigência Excessiva de Quantitativo em Atestado Técnico (> 50%)',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 67, § 1º e § 2º da Lei nº 14.133/2021 e Súmula nº 263 do TCU',
          explicacaoSimples:
            'O edital impõe comprovação de aptidão técnica em percentual superior a 50% do quantitativo licitado. A Lei nº 14.133/2021 limita expressamente os atestados às parcelas de maior relevância com quantitativo mínimo de até 50%. Exigência acima desse teto restringe indevidamente a competitividade e afasta fornecedores aptos. Recomenda-se impugnar o subitem antes da sessão para adequação ao limite legal.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital requerendo a limitação do quantitativo exigido a no máximo 50%.',
        });
      }

      // 2. Restrição geográfica / sede local prévia
      if (
        /(?:possuir\s+sede\s+n[ao]|obrigatoriamente\s+sediad[ao]|escrit[óo]rio\s+local\s+pr[ée]vio|filial\s+no\s+munic[íi]pio\s+para\s+habilita[çc][ãa]o|atestado\s+emitido\s+no\s+estado|registro\s+no\s+conselho\s+regional\s+local\s+antes\s+da\s+contrata[çc][ãa]o)/i.test(para)
      ) {
        registerOnce({
          id: 'vicio-restricao-geografica',
          titulo: 'Restrição Geográfica Indevida ou Exigência de Sede Local Prévia',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 9º, inciso I, alínea "a" da Lei nº 14.133/2021 e Súmula nº 272 do TCU',
          explicacaoSimples:
            'A cláusula condiciona a participação ou habilitação à existência prévia de sede, filial ou registro regional em localidade específica. A Nova Lei de Licitações veda expressamente cláusulas que frustrem o caráter competitivo por critérios geográficos impertinentes. Na prática, essa exigência impede empresas de outras cidades ou estados de competir em igualdade de condições. Cabe impugnação imediata para supressão do requisito territorial.',
          acaoRecomendada: 'Protocolar Impugnação ao Edital requerendo a exclusão da exigência de sede ou registro prévio local.',
        });
      }

      // 3. Direcionamento de marca específica (sem falso positivo em "Modelo de Declaração")
      const hasMarcaRestriction =
        /(?:exig[eê]ncia\s+de\s+marca|somente\s+(?:ser[áa]\s+aceit[ao]\s+)?(?:a\s+)?marca|exclusivamente\s+(?:da\s+)?marca|obrigatoriamente\s+(?:da\s+)?marca|vedada\s+a\s+substitui[çc][ãa]o\s+de\s+marca|marca\s+e\s+modelo\s+espec[íi]ficos)/i.test(para);
      const hasEquivalenceEscape =
        /(?:ou\s+similar|ou\s+equivalente|equivalente\s+t[eé]cnico|de\s+melhor\s+qualidade|apenas\s+como\s+refer[êe]ncia|para\s+fins\s+de\s+refer[êe]ncia)/i.test(para);
      if (hasMarcaRestriction && !hasEquivalenceEscape) {
        registerOnce({
          id: 'vicio-direcionamento-marca',
          titulo: 'Exigência de Marca Específica sem Justificativa Técnica e sem Cláusula "ou equivalente"',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 41, inciso I da Lei nº 14.133/2021 e Súmula nº 270 do TCU',
          explicacaoSimples:
            'O instrumento convocatório determina a aquisição ou cotação de marca específica sem admitir produto similar ou equivalente técnico. Segundo a Lei nº 14.133/2021 e a Súmula 270 do TCU, a indicação de marca só é admitida excepcionalmente com justificativa técnica formal ou como mera referência acompanhada de "ou equivalente". Sem essa ressalva, licitantes com produtos compatíveis ficam sujeitos à desclassificação sumária. Recomenda-se impugnar para inclusão da equivalência técnica.',
          acaoRecomendada: 'Protocolar Impugnação exigindo a inclusão da expressão "ou equivalente" ou justificativa técnica formal.',
        });
      }

      // 4. Certificação privada (ISO, CMMI, etc.) como requisito eliminatório de habilitação
      if (
        /(?:certifica[çc][ãa]o\s+ISO|ISO\s*9001|ISO\s*27001|ISO\s*14001|CMMI|MPS\.BR)[^.]{0,140}(?:habilita[çc][ãa]o|desclassifica[çc][ãa]o|inabilita[çc][ãa]o|sob\s+pena)/i.test(para)
      ) {
        registerOnce({
          id: 'vicio-certificacao-iso',
          titulo: 'Exigência Ilegal de Certificação Privada (ISO / CMMI) na Habilitação',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Arts. 62 a 70 da Lei nº 14.133/2021 e Acórdão 1.214/2013-Plenário do TCU',
          explicacaoSimples:
            'O edital exige certificação privada de qualidade ou gestão como condição eliminatória de habilitação. O rol de documentos habilitatórios da Lei nº 14.133/2021 é taxativo e não contempla certificados ISO ou similares como requisito eliminatório. A manutenção dessa regra exclui concorrentes regulares que atendem integralmente ao objeto, gerando risco elevado de nulidade do certame. Recomenda-se impugnação formal do item.',
          acaoRecomendada: 'Protocolar Impugnação requerendo a exclusão da certificação privada da fase de habilitação.',
        });
      }

      // 5. Vistoria obrigatória sem declaração formal substitutiva
      if (
        /(?:vistoria|visita\s+t[eé]cnica)\s+obrigat[óo]ria/i.test(para) &&
        !/(?:declara[çc][ãa]o\s+formal|declara[çc][ãa]o\s+de\s+conhecimento|facultada\s+a\s+substitui[çc][ãa]o|pode\s+ser\s+substitu[íi]da)/i.test(seg.texto)
      ) {
        registerOnce({
          id: 'vicio-vistoria-obrigatoria',
          titulo: 'Vistoria Presencial Obrigatória sem Opção de Declaração Substitutiva',
          gravidade: 'MEDIO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 63, § 2º e § 3º da Lei nº 14.133/2021 e Súmula nº 272 do TCU',
          explicacaoSimples:
            'A cláusula impõe visita técnica obrigatória ao local sem prever a faculdade de substituição por declaração formal de pleno conhecimento. O Art. 63, § 3º da Lei nº 14.133/2021 assegura expressamente ao licitante optar pela declaração formal em vez do deslocamento prévio. Sem essa garantia, empresas de outras regiões sofrem ônus desproporcional antes mesmo da disputa. Recomenda-se pedido de esclarecimento ou impugnação.',
          acaoRecomendada: 'Protocolar Esclarecimento ou Impugnação para assegurar a substituição por declaração formal.',
        });
      }

      // 6. Prazo de entrega exíguo (24h/48h) sem urgência/perecibilidade
      if (
        /(?:prazo\s+(?:m[áa]ximo\s+)?de\s+entrega|execu[çc][ãa]o)[^.]{0,90}\b(?:24\s*horas|48\s*horas|1\s*dia\s*[úu]til)\b/i.test(para) &&
        !/(?:perec[íi]vel|urg[eê]ncia\s+m[eé]dica|pronto\s+socorro|hortifruti|combust[íi]vel)/i.test(textoCompleto)
      ) {
        registerOnce({
          id: 'vicio-prazo-exiguo',
          titulo: 'Prazo de Entrega Exíguo ou Desproporcional (24h / 48h)',
          gravidade: 'MEDIO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 5º e Art. 40, § 2º da Lei nº 14.133/2021 (Princípio da Razoabilidade)',
          explicacaoSimples:
            'O edital estabelece prazo de entrega extremamente reduzido (24h, 48h ou 1 dia útil) sem natureza perecível ou emergência médica que o justifique. Na prática, prazos inexequíveis operam como barreira geográfica disfarçada, privilegiando exclusivamente fornecedores instalados ao lado do órgão. Isso compromete a ampla competitividade e eleva o risco de penalidades contratuais futuras. Recomenda-se impugnar ou pedir esclarecimento para ampliação do prazo.',
          acaoRecomendada: 'Enviar Pedido de Esclarecimento ou Impugnação solicitando prazo compatível com a logística nacional.',
        });
      }

      // 7. Garantia contratual acima de 10%
      if (
        /(?:garantia\s+contratual|garantia\s+de\s+execu[çc][ãa]o)[^.]{0,90}\b(?:1[1-9]|[2-9]\d)\s*%/i.test(para)
      ) {
        registerOnce({
          id: 'vicio-garantia-excessiva',
          titulo: 'Exigência de Garantia Contratual Acima do Limite Legal',
          gravidade: 'MEDIO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 98 da Lei nº 14.133/2021 (teto de 5%, ou 10% mediante justificativa)',
          explicacaoSimples:
            'O instrumento fixa garantia contratual em percentual superior ao máximo autorizado pela legislação. O Art. 98 da Lei nº 14.133/2021 limita a garantia a até 5% do valor inicial do contrato, admitindo elevação até 10% apenas em contratações justificadas pela complexidade técnica e riscos. Percentuais superiores oneram excessivamente a operação financeira do contratado. Recomenda-se impugnar para adequação ao limite legal.',
          acaoRecomendada: 'Protocolar Impugnação requerendo a redução da garantia ao teto legal do Art. 98.',
        });
      }
      // 8. Garantia de proposta / caucao acima de 1% ou exigencia previa
      if (/(?:garantia\s+(?:de|da)\s+proposta|cau[cç][aã]o\s+de\s+proposta)[^.]{0,140}(?:[2-9]\s*%|\d{2,}\s*%)/i.test(para)) {
        registerOnce({
          id: 'vicio-garantia-proposta-acima-1',
          titulo: 'Garantia de Proposta / Caucao Acima do Limite Legal de 1%',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 58, paragrafo 1o da Lei no 14.133/2021',
          explicacaoSimples:
            'O edital fixa garantia de proposta em percentual superior a 1% do valor estimado da contratacao. O Art. 58, paragrafo 1o da Lei 14.133/2021 estabelece teto absoluto de 1% para a garantia de proposta. Exigencia superior cria barreira financeira ilegal antes mesmo da fase de lances e afasta pequenas e medias empresas. Recomenda-se impugnar imediatamente para reducao ao teto legal.',
          acaoRecomendada: 'Protocolar Impugnacao exigindo adequacao da garantia de proposta ao limite maximo de 1%.',
        });
      }

      // 9. Experiencia previa exclusiva com orgaos publicos
      if (/(?:atestado|experi[eê]ncia|comprova[cç][aã]o)[^.]{0,140}(?:exclusivamente\s+(?:em|com|por)\s+[oó]rg[aã]os?\s+p[uú]blicos?|somente\s+(?:de|por)\s+pessoa\s+jur[ií]dica\s+de\s+direito\s+p[uú]blico|vedad[oa]\s+atestado\s+de\s+empresa\s+privada)/i.test(para)) {
        registerOnce({
          id: 'vicio-exclusividade-orgao-publico',
          titulo: 'Restricao Ilegal: Exigencia de Atestado Exclusivo de Orgao Publico',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 67, inciso II da Lei no 14.133/2021 e Jurisprudencia Consolidada do TCU',
          explicacaoSimples:
            'A clausula restringe a comprovacao de capacidade tecnica a atestados emitidos exclusivamente por orgaos ou entidades publicas, vedando atestados de pessoas juridicas de direito privado. A Lei no 14.133/2021 admite expressamente atestados fornecidos por pessoas juridicas de direito publico ou privado. Essa restricao elimina empresas tecnicamente aptas que atuam no setor privado e fere a isonomia. Cabe impugnacao direta do subitem.',
          acaoRecomendada: 'Protocolar Impugnacao requerendo a aceitacao expressa de atestados emitidos por pessoas juridicas de direito privado.',
        });
      }

      // 10. Lote unico / preco global sem justificativa de indivisibilidade
      if (/(?:lote\s+[uú]nico|grupo\s+[uú]nico)[^.]{0,140}(?:menor\s+pre[cç]o\s+global|adjudica[cç][aã]o\s+global)/i.test(para)) {
        registerOnce({
          id: 'atencao-lote-unico',
          titulo: 'Aglutinacao em Lote Unico / Preco Global (Risco de Restricao a Competitividade)',
          gravidade: 'MEDIO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 40, paragrafo 3o da Lei no 14.133/2021 e Sumula no 247 do TCU',
          explicacaoSimples:
            'O certame reune o objeto em lote unico com julgamento pelo menor preco global. Conforme a Sumula 247 do TCU, e obrigatoria a adjudicacao por item quando o objeto for divisivel e nao houver prejuizo tecnico ou perda de economia de escala. A aglutinacao imotivada impede empresas especializadas em parte dos servicos ou itens de participar da disputa. Recomenda-se verificar o ETP e pedir esclarecimento ou impugnar se houver divisibilidade tecnica.',
          acaoRecomendada: 'Solicitar via Esclarecimento a justificativa tecnica do ETP para o nao parcelamento ou impugnar pelo parcelamento por item.',
        });
      }

      // 11. Prova de conceito exigindo solucao pronta ou prazo exiguo
      if (/(?:prova\s+de\s+conceito|poc\b)[^.]{0,160}(?:24\s*horas|48\s*horas|1\s*dia\s*[uú]til|integralmente\s+operacional|todos\s+os\s+licitantes)/i.test(para)) {
        registerOnce({
          id: 'vicio-poc-restritiva',
          titulo: 'Prova de Conceito (POC) Desproporcional ou com Prazo Exiguo',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 17, paragrafo 3o e Art. 41, inciso II da Lei no 14.133/2021',
          explicacaoSimples:
            'O edital impoe Prova de Conceito com prazo exiguo, exigencia a todos os licitantes simultaneamente ou cobranca de sistema ja customizado antes da contratacao. Pela Lei no 14.133/2021 e jurisprudencia do TCU, a POC so pode ser exigida do licitante provisoriamente classificado em primeiro lugar e em prazo razoavel, com criterios objetivos. Exigir customizacao previa onera indevidamente a disputa. Cabe impugnacao ou esclarecimento.',
          acaoRecomendada: 'Protocolar Impugnacao ou Esclarecimento para limitar a POC ao 1o colocado, com roteiro objetivo e prazo razoavel.',
        });
      }

      // 12. Capital social + patrimonio liquido cumulativos ou acima de 10%
      if (
        /(?:capital\s+social|patrim[oô]nio\s+l[ií]quido)[^.]{0,140}(?:1[1-9]|[2-9]\d)\s*%/i.test(para) ||
        (/capital\s+social/i.test(para) && /patrim[oô]nio\s+l[ií]quido/i.test(para) && /cumulativ/i.test(para))
      ) {
        registerOnce({
          id: 'vicio-economico-financeiro',
          titulo: 'Exigencia Econ.-Financeira Ilegal (Cumulativa ou Acima de 10%)',
          gravidade: 'ALTO',
          arquivoOrigem: seg.arquivo,
          pagina: seg.pagina,
          clausula,
          trechoLiteral: quote,
          fundamentoLegal: 'Art. 69, paragrafo 4o da Lei no 14.133/2021 e Sumula no 275 do TCU',
          explicacaoSimples:
            'A clausula exige capital social ou patrimonio liquido minimo acima de 10% do valor estimado ou de forma cumulativa. O Art. 69, paragrafo 4o da Lei 14.133/2021 limita a exigencia a ate 10% e veda a cumulacao conforme a Sumula 275 do TCU. Essa pratica exclui empresas saudaveis financeiramente. Recomenda-se impugnar o subitem para adequacao ao teto legal de 10% de forma alternativa.',
          acaoRecomendada: 'Protocolar Impugnacao exigindo adequacao ao limite maximo de 10% e vedacao de cumulatividade.',
        });
      }
    }
  }

  return Array.from(found.values());
}

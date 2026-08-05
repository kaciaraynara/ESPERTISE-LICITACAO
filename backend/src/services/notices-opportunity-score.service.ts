export interface LicitacaoScoreInput {
  objeto: string;
  dataAberturaProposta?: Date | string | null;
  valorEstimado?: number | null;
  exclusivoMEEPP?: boolean;
}

export interface PerfilFornecedorInput {
  cnaeKeywords: string[];
  isMEEPP: boolean;
}

export interface ScoreResult {
  score: number;
  classificacao: 'ALTA' | 'MEDIA' | 'BAIXA';
  justificativa: string[];
}

export function calcularScoreOportunidade(
  licitacao: LicitacaoScoreInput,
  perfil: PerfilFornecedorInput
): ScoreResult {
  let score = 0;
  const justificativa: string[] = [];

  // 1. Aderência de Objeto ao CNAE/Atividade (Até 50 pontos)
  const objetoLower = (licitacao.objeto || '').toLowerCase();
  const termosEncontrados = perfil.cnaeKeywords.filter((kw) =>
    objetoLower.includes(kw.toLowerCase())
  );

  if (termosEncontrados.length > 0) {
    const pontosMatch = Math.min(50, termosEncontrados.length * 25);
    score += pontosMatch;
    justificativa.push(`Alta compatibilidade de objeto com palavras-chave (${termosEncontrados.join(', ')}).`);
  } else {
    justificativa.push('Baixa correspondência direta com os CNAEs cadastrados.');
  }

  // 2. Prazo Restante para Submissão de Proposta (Até 30 pontos)
  if (licitacao.dataAberturaProposta) {
    const hoje = new Date().getTime();
    const dataAbertura = new Date(licitacao.dataAberturaProposta).getTime();
    const diasRestantes = Math.ceil((dataAbertura - hoje) / (1000 * 60 * 60 * 24));

    if (diasRestantes >= 5) {
      score += 30;
      justificativa.push(`Prazo confortável para elaboração (${diasRestantes} dias).`);
    } else if (diasRestantes >= 2) {
      score += 15;
      justificativa.push(`Prazo moderado para elaboração (${diasRestantes} dias).`);
    } else if (diasRestantes > 0) {
      score += 5;
      justificativa.push('Prazo crítico para envio de propostas.');
    } else {
      justificativa.push('Sessão pública em andamento ou encerrada.');
    }
  }

  // 3. Vantagem Competitiva ME/EPP (Até 20 pontos)
  if (licitacao.exclusivoMEEPP && perfil.isMEEPP) {
    score += 20;
    justificativa.push('Edital exclusivo para ME/EPP com reserva de cota.');
  } else if (!licitacao.exclusivoMEEPP) {
    score += 10;
    justificativa.push('Ampla concorrência.');
  }

  const scoreFinal = Math.min(100, Math.max(0, score));

  let classificacao: 'ALTA' | 'MEDIA' | 'BAIXA' = 'BAIXA';
  if (scoreFinal >= 70) classificacao = 'ALTA';
  else if (scoreFinal >= 40) classificacao = 'MEDIA';

  return {
    score: scoreFinal,
    classificacao,
    justificativa,
  };
}
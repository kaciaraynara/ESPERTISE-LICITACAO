export const DIAS_UTEIS_ANTECEDENCIA_IMPUGNACAO = 3;

export interface PrazoDecadencialImpugnacao {
  dataCertame: string;
  prazoDecadencial: string;
  diasUteisAntes: number;
  tempestivoHoje: boolean;
  diasCorridosAtePrazo: number;
  fundamentoLegal: {
    lei: 'Lei 14.133/2021';
    artigo: 'art. 164, caput';
    descricao: string;
  };
}

export type TipoObjetoLicitacao =
  | 'BENS'
  | 'SERVICOS_COMUNS'
  | 'SERVICOS_ESPECIAIS'
  | 'OBRAS_COMUNS'
  | 'OBRAS_ESPECIAIS'
  | 'CONTRATACAO_INTEGRADA'
  | 'CONTRATACAO_SEMI_INTEGRADA'
  | 'LEILAO'
  | 'CONCURSO'
  | 'DIALOGO_COMPETITIVO';

export type CriterioJulgamento =
  | 'MENOR_PRECO'
  | 'MAIOR_DESCONTO'
  | 'MELHOR_TECNICA'
  | 'TECNICA_E_PRECO'
  | 'MAIOR_LANCE'
  | 'MAIOR_RETORNO_ECONOMICO';

export interface PrazoApresentacaoPropostaParams {
  tipoObjeto: TipoObjetoLicitacao;
  criterioJulgamento?: CriterioJulgamento;
  dataPublicacaoEdital: string | Date;
}

export interface PrazoApresentacaoPropostaResult {
  dataPublicacao: string;
  dataMinimaAbertura: string;
  diasUteisMinimos: number;
  fundamentoLegal: {
    lei: 'Lei 14.133/2021';
    artigo: 'art. 55';
    inciso: string;
    descricao: string;
  };
}

export interface PrazosRecursaisLei14133 {
  dataIntimacao: string;
  prazoIntencao: string;
  limiteRazoesRecursais: string;
  diasUteisRazoes: number;
  limiteContrarrazoesEstimado: string;
  diasUteisContrarrazoes: number;
  limiteJulgamentoEstimado: string;
  diasUteisDecisao: number;
  fundamentoLegal: {
    lei: 'Lei 14.133/2021';
    artigo: 'art. 165';
    descricao: string;
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calcularPrazoDecadencialImpugnacao(
  dataCertame: string | Date,
): PrazoDecadencialImpugnacao {
  const certameDate = parseCalendarDate(dataCertame);
  let cursor = certameDate;
  let diasUteis = 0;

  while (diasUteis < DIAS_UTEIS_ANTECEDENCIA_IMPUGNACAO) {
    cursor = addUtcDays(cursor, -1);

    if (isBusinessDay(cursor)) {
      diasUteis += 1;
    }
  }

  const today = startOfUtcDay(new Date());
  const prazoDay = startOfUtcDay(cursor);
  const diasCorridosAtePrazo = Math.ceil((prazoDay.getTime() - today.getTime()) / MS_PER_DAY);

  return {
    dataCertame: formatDateOnly(certameDate),
    prazoDecadencial: formatDateOnly(cursor),
    diasUteisAntes: DIAS_UTEIS_ANTECEDENCIA_IMPUGNACAO,
    tempestivoHoje: today.getTime() <= prazoDay.getTime(),
    diasCorridosAtePrazo,
    fundamentoLegal: {
      lei: 'Lei 14.133/2021',
      artigo: 'art. 164, caput',
      descricao: 'Pedido de impugnacao ou esclarecimento deve ser protocolado ate 3 dias uteis antes da data de abertura do certame.',
    },
  };
}

export function calcularPrazosMinimosApresentacaoProposta(
  params: PrazoApresentacaoPropostaParams,
): PrazoApresentacaoPropostaResult {
  const { tipoObjeto, criterioJulgamento, dataPublicacaoEdital } = params;
  const dataPub = parseCalendarDate(dataPublicacaoEdital);

  let diasUteisMinimos = 10;
  let inciso = 'art. 55, II, "a"';
  let descricao = '10 dias úteis para serviços e obras comuns.';

  const isMenorPrecoOuMaiorDesconto =
    criterioJulgamento === 'MENOR_PRECO' || criterioJulgamento === 'MAIOR_DESCONTO';

  switch (tipoObjeto) {
    case 'BENS':
      if (isMenorPrecoOuMaiorDesconto) {
        diasUteisMinimos = 8;
        inciso = 'art. 55, I, "a"';
        descricao = '8 dias úteis para aquisição de bens por menor preço ou maior desconto.';
      } else {
        diasUteisMinimos = 15;
        inciso = 'art. 55, I, "b"';
        descricao = '15 dias úteis para aquisição de bens nos demais critérios de julgamento.';
      }
      break;

    case 'SERVICOS_COMUNS':
    case 'OBRAS_COMUNS':
      if (isMenorPrecoOuMaiorDesconto) {
        diasUteisMinimos = 10;
        inciso = 'art. 55, II, "a"';
        descricao = '10 dias úteis para serviços comuns e obras e serviços comuns de engenharia (menor preço/maior desconto).';
      } else {
        diasUteisMinimos = 35;
        inciso = 'art. 55, II, "d"';
        descricao = '35 dias úteis para serviços/obras em regimes ou critérios diferenciados.';
      }
      break;

    case 'SERVICOS_ESPECIAIS':
    case 'OBRAS_ESPECIAIS':
      if (isMenorPrecoOuMaiorDesconto) {
        diasUteisMinimos = 25;
        inciso = 'art. 55, II, "b"';
        descricao = '25 dias úteis para serviços especiais e obras e serviços especiais de engenharia (menor preço/maior desconto).';
      } else {
        diasUteisMinimos = 35;
        inciso = 'art. 55, II, "d"';
        descricao = '35 dias úteis para serviços especiais ou contratação semi-integrada.';
      }
      break;

    case 'CONTRATACAO_INTEGRADA':
      diasUteisMinimos = 60;
      inciso = 'art. 55, II, "c"';
      descricao = '60 dias úteis quando o regime de execução for de contratação integrada.';
      break;

    case 'CONTRATACAO_SEMI_INTEGRADA':
      diasUteisMinimos = 35;
      inciso = 'art. 55, II, "d"';
      descricao = '35 dias úteis quando o regime de execução for de contratação semi-integrada.';
      break;

    case 'LEILAO':
      diasUteisMinimos = 15;
      inciso = 'art. 55, III';
      descricao = '15 dias úteis no caso de leilão.';
      break;

    case 'CONCURSO':
      diasUteisMinimos = 35;
      inciso = 'art. 55, IV';
      descricao = '35 dias úteis no caso de concurso.';
      break;

    case 'DIALOGO_COMPETITIVO':
      diasUteisMinimos = 25;
      inciso = 'art. 55, V';
      descricao = '25 dias úteis para manifestação de interesse no diálogo competitivo (e até 60 dias úteis para propostas).';
      break;

    default:
      diasUteisMinimos = 10;
      inciso = 'art. 55, II, "a"';
      descricao = '10 dias úteis regra geral.';
  }

  const dataMinimaAbertura = somarDiasUteis(dataPub, diasUteisMinimos);

  return {
    dataPublicacao: formatDateOnly(dataPub),
    dataMinimaAbertura: formatDateOnly(dataMinimaAbertura),
    diasUteisMinimos,
    fundamentoLegal: {
      lei: 'Lei 14.133/2021',
      artigo: 'art. 55',
      inciso,
      descricao,
    },
  };
}

export function calcularPrazosRecursoLei14133(
  dataIntimacaoOuAta: string | Date,
): PrazosRecursaisLei14133 {
  const dataIntimacao = parseCalendarDate(dataIntimacaoOuAta);
  const limiteRazoes = somarDiasUteis(dataIntimacao, 3);
  const limiteContrarrazoes = somarDiasUteis(limiteRazoes, 3);
  const limiteJulgamento = somarDiasUteis(limiteContrarrazoes, 10);

  return {
    dataIntimacao: formatDateOnly(dataIntimacao),
    prazoIntencao: 'Imediata em sessão pública, sob pena de preclusão (art. 165, § 1º)',
    limiteRazoesRecursais: formatDateOnly(limiteRazoes),
    diasUteisRazoes: 3,
    limiteContrarrazoesEstimado: formatDateOnly(limiteContrarrazoes),
    diasUteisContrarrazoes: 3,
    limiteJulgamentoEstimado: formatDateOnly(limiteJulgamento),
    diasUteisDecisao: 10,
    fundamentoLegal: {
      lei: 'Lei 14.133/2021',
      artigo: 'art. 165',
      descricao: 'Intenção imediata em sessão; 3 dias úteis para razões e 3 dias úteis para contrarrazões; decisão em até 10 dias úteis.',
    },
  };
}

export function somarDiasUteis(dataInicio: Date, diasUteis: number): Date {
  let cursor = new Date(dataInicio);
  let adicionados = 0;

  while (adicionados < diasUteis) {
    cursor = addUtcDays(cursor, 1);
    if (isBusinessDay(cursor)) {
      adicionados += 1;
    }
  }

  return cursor;
}

export function parseCalendarDate(value: string | Date) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('INVALID_CERTAME_DATE');
    }

    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return assertValidDate(Number(year), Number(month), Number(day));
  }

  if (brMatch) {
    const [, day, month, year] = brMatch;
    return assertValidDate(Number(year), Number(month), Number(day));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_CERTAME_DATE');
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function assertValidDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('INVALID_CERTAME_DATE');
  }

  return date;
}

export function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function addUtcDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}


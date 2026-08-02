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

function parseCalendarDate(value: string | Date) {
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

function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addUtcDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

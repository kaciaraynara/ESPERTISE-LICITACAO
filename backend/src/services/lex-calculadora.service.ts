import dayjs from 'dayjs';
import { LexDeterministicCalculation } from '../types/lex.types';

/**
 * Calculadora determinística para o LEX.
 * Executa todos os cálculos matemáticos e prazos processuais fora do LLM,
 * prevenindo alucinações e garantindo reprodutibilidade estrita.
 */
export class LexCalculadoraService {
  /**
   * Calcula o prazo final para protocolo de impugnação ao edital.
   * Base legal: Art. 164 da Lei 14.133/2021:
   * "devendo protocolar o pedido até 3 (três) dias úteis antes da data de abertura do certame."
   */
  static calcularPrazoImpugnacao(
    dataAbertura: Date | string,
    dataReferencia: Date | string = new Date(),
  ): LexDeterministicCalculation {
    const abertura = dayjs(dataAbertura);
    const hoje = dayjs(dataReferencia);

    if (!abertura.isValid()) {
      return {
        tipo: 'prazo_impugnacao',
        formula: 'Data de Abertura - 3 dias úteis (Art. 164, Lei 14.133/2021)',
        parametrosEntrada: { dataAbertura },
        resultado: null,
        descricao: 'Data de abertura do edital inválida ou não informada.',
        fundamentacaoLegal: 'Art. 164 da Lei 14.133/2021',
      };
    }

    // Regra de contagem regressiva de dias úteis (exclui sábado e domingo)
    let diasUteisContados = 0;
    let cursor = abertura.clone();

    // Começa voltando do dia anterior à abertura
    while (diasUteisContados < 3) {
      cursor = cursor.subtract(1, 'day');
      const diaSemana = cursor.day(); // 0 = Domingo, 6 = Sábado
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasUteisContados += 1;
      }
    }

    // O prazo limite se encerra às 23:59:59 do 3º dia útil anterior
    const dataLimite = cursor.endOf('day');
    const expirado = hoje.isAfter(dataLimite);
    const diasUteisRestantes = expirado ? 0 : this.contarDiasUteis(hoje, dataLimite);

    return {
      tipo: 'prazo_impugnacao',
      formula: 'DataLimite = Abertura - 3 dias úteis (excluindo sábados e domingos)',
      parametrosEntrada: {
        dataAbertura: abertura.toISOString(),
        dataReferencia: hoje.toISOString(),
      },
      resultado: {
        dataLimite: dataLimite.toISOString(),
        dataLimiteFormatada: dataLimite.format('DD/MM/YYYY [às] HH:mm'),
        expirado,
        diasUteisRestantes,
        statusPrazo: expirado ? 'EXPIRADO' : 'TEMPESTIVO',
      },
      descricao: `Prazo final para impugnação: ${dataLimite.format('DD/MM/YYYY')} (3 dias úteis antes de ${abertura.format('DD/MM/YYYY')}). Situação: ${expirado ? 'PRAZO EXPIRADO' : 'TEMPESTIVO'}.`,
      fundamentacaoLegal: 'Art. 164 da Lei 14.133/2021',
    };
  }

  /**
   * Calcula o prazo final para razões de recurso.
   * Base legal: Art. 165, § 1º da Lei 14.133/2021 (3 dias úteis).
   */
  static calcularPrazoRecurso(
    dataIntencaoOuAto: Date | string,
    dataReferencia: Date | string = new Date(),
  ): LexDeterministicCalculation {
    const inicio = dayjs(dataIntencaoOuAto);
    const hoje = dayjs(dataReferencia);

    if (!inicio.isValid()) {
      return {
        tipo: 'prazo_recurso',
        formula: 'Data Inicial + 3 dias úteis (Art. 165, § 1º, Lei 14.133/2021)',
        parametrosEntrada: { dataIntencaoOuAto },
        resultado: null,
        descricao: 'Data de intimação ou manifestação de intenção inválida.',
        fundamentacaoLegal: 'Art. 165, § 1º da Lei 14.133/2021',
      };
    }

    let diasUteisContados = 0;
    let cursor = inicio.clone();

    while (diasUteisContados < 3) {
      cursor = cursor.add(1, 'day');
      const diaSemana = cursor.day();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasUteisContados += 1;
      }
    }

    const dataLimite = cursor.endOf('day');
    const expirado = hoje.isAfter(dataLimite);
    const diasUteisRestantes = expirado ? 0 : this.contarDiasUteis(hoje, dataLimite);

    return {
      tipo: 'prazo_recurso',
      formula: 'DataLimite = Ato/Intimação + 3 dias úteis (excluindo sábados e domingos)',
      parametrosEntrada: {
        dataIntencaoOuAto: inicio.toISOString(),
        dataReferencia: hoje.toISOString(),
      },
      resultado: {
        dataLimite: dataLimite.toISOString(),
        dataLimiteFormatada: dataLimite.format('DD/MM/YYYY [às] HH:mm'),
        expirado,
        diasUteisRestantes,
        statusPrazo: expirado ? 'EXPIRADO' : 'TEMPESTIVO',
      },
      descricao: `Prazo para razões recursais: ${dataLimite.format('DD/MM/YYYY')} (3 dias úteis a contar de ${inicio.format('DD/MM/YYYY')}). Situação: ${expirado ? 'PRAZO EXPIRADO' : 'TEMPESTIVO'}.`,
      fundamentacaoLegal: 'Art. 165, § 1º da Lei 14.133/2021',
    };
  }

  /**
   * Calcula BDI segundo a fórmula canônica recomendada pelo TCU (Acórdão 2622/2013 - Plenário).
   * BDI = [ ((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) ] - 1
   */
  static calcularBdi(params: {
    administracaoCentral: number; // AC em %
    seguroGarantia: number;       // S+G em %
    risco: number;                // R em %
    despesasFinanceiras: number;  // DF em %
    lucro: number;                // L em %
    tributos: number;             // I em % (ISS, PIS, COFINS, CPRB)
  }): LexDeterministicCalculation {
    const ac = params.administracaoCentral / 100;
    const sg = params.seguroGarantia / 100;
    const r = params.risco / 100;
    const df = params.despesasFinanceiras / 100;
    const l = params.lucro / 100;
    const i = params.tributos / 100;

    if (i >= 1) {
      return {
        tipo: 'bdi',
        formula: 'Acórdão 2622/2013-TCU-Plenário',
        parametrosEntrada: params,
        resultado: null,
        descricao: 'Alíquota de tributos inválida (não pode ser igual ou superior a 100%).',
        fundamentacaoLegal: 'Súmula 253/TCU e Acórdão 2622/2013 - TCU Plenário',
      };
    }

    const numerador = (1 + ac + sg + r) * (1 + df) * (1 + l);
    const denominador = 1 - i;
    const bdiDecimal = (numerador / denominador) - 1;
    const bdiPercentual = Number((bdiDecimal * 100).toFixed(2));

    return {
      tipo: 'bdi',
      formula: 'BDI = [ ((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) ] - 1',
      parametrosEntrada: params,
      resultado: {
        bdiPercentual,
        bdiDecimal: Number(bdiDecimal.toFixed(4)),
      },
      descricao: `BDI calculado determinísticamente: ${bdiPercentual}% com base na metodologia do Acórdão 2622/2013 - TCU Plenário.`,
      fundamentacaoLegal: 'Acórdão 2622/2013 - TCU Plenário',
    };
  }

  private static contarDiasUteis(de: dayjs.Dayjs, ate: dayjs.Dayjs): number {
    let dias = 0;
    let cursor = de.clone();
    while (cursor.isBefore(ate, 'day')) {
      cursor = cursor.add(1, 'day');
      const diaSemana = cursor.day();
      if (diaSemana !== 0 && diaSemana !== 6) {
        dias += 1;
      }
    }
    return dias;
  }
}

import axios, { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';
import { getNumberEnv, getStringEnv } from '../config/env';
import { prisma } from '../database/prisma';

const DEFAULT_BASE_URL = 'https://api.infosimples.com/api/v2/consultas';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_SIZE_BYTES = 15 * 1024 * 1024;

export type InfoSimplesServiceType = 'cnd-federal' | 'crf-fgts' | 'cndt';

export type InfoSimplesRegularidade = 'REGULAR' | 'IRREGULAR' | 'NAO_IDENTIFICADA';

export interface InfoSimplesCertificateRecord extends Record<string, unknown> {
  status?: string;
  situacao?: string;
  regularidade?: string;
  data_validade?: string;
  validade?: string;
  data_validade_certidao?: string;
  site_receipt_url?: string;
  pdf_url?: string;
  url_pdf?: string;
}

export interface InfoSimplesSiteReceipt {
  url?: string;
  site_receipt_url?: string;
  pdf_url?: string;
}

export interface InfoSimplesResponse<TRecord extends Record<string, unknown> = Record<string, unknown>> {
  code: number;
  code_message?: string;
  errors?: unknown[];
  data_count?: number;
  data: TRecord[];
  site_receipt_url?: string;
  pdf_url?: string;
  site_receipts?: InfoSimplesSiteReceipt[];
}

export interface SyncedCertificate {
  type: 'RECEITA' | 'FGTS' | 'TRABALHISTA';
  regularidade: InfoSimplesRegularidade;
  statusOriginal: string | null;
  expirationDate: string;
  documentUrl: string | null;
}

export interface InfoSimplesSyncResult {
  companyId: string;
  synchronizedAt: string;
  certificates: SyncedCertificate[];
}

export class InfoSimplesError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'InfoSimplesError';
  }
}

function normalizeCnpj(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function validateCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  if (
    !/^[A-Z0-9]{12}\d{2}$/.test(cnpj)
    || /^([A-Z0-9])\1{13}$/.test(cnpj)
    || !hasValidCnpjCheckDigits(cnpj)
  ) {
    throw new InfoSimplesError(
      'CNPJ inválido para consulta na InfoSimples.',
      'INVALID_CNPJ',
      400,
    );
  }
  return cnpj;
}

function hasValidCnpjCheckDigits(cnpj: string): boolean {
  const calculateDigit = (value: string, weights: number[]): number => {
    const sum = [...value].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(
    cnpj.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  if (Number(cnpj[12]) !== firstDigit) return false;

  const secondDigit = calculateDigit(
    cnpj.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return Number(cnpj[13]) === secondDigit;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function getRecordString(
  record: InfoSimplesCertificateRecord,
  fields: Array<keyof InfoSimplesCertificateRecord>,
): string | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function parseExpirationDate(value: string | null): Date | null {
  if (!value) return null;

  const brazilianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s.*)?$/);
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() === Number(month) - 1
      && parsed.getUTCDate() === Number(day)
    ) return parsed;
    return null;
  }

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() === Number(month) - 1
      && parsed.getUTCDate() === Number(day)
    ) return parsed;
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapRegularity(status: string | null): InfoSimplesRegularidade {
  if (!status) return 'NAO_IDENTIFICADA';

  const normalized = normalizeText(status);
  if (
    normalized.includes('EFEITOS DE NEGATIVA')
  ) return 'REGULAR';

  if (
    normalized.includes('POSITIVA')
    || normalized.includes('IRREGULAR')
    || normalized.includes('INADIMPLENTE')
    || normalized.includes('PENDENCIA')
    || normalized.includes('DEBITO')
    || normalized.includes('VENCIDA')
    || normalized.includes('NAO REGULAR')
    || normalized.includes('NAO VALIDA')
  ) return 'IRREGULAR';

  if (
    normalized.includes('NEGATIVA')
    || normalized.includes('REGULAR')
    || normalized.includes('VALIDA')
    || normalized.includes('SEM DEBITOS')
    || normalized.includes('NADA CONSTA')
    || normalized.includes('SEM PENDENCIA')
  ) return 'REGULAR';

  return 'NAO_IDENTIFICADA';
}

function isHttpUrl(value: string | null): value is string {
  return Boolean(value && /^https?:\/\/\S+$/i.test(value));
}

function getReceiptUrl(
  record: InfoSimplesCertificateRecord,
  response: InfoSimplesResponse<InfoSimplesCertificateRecord>,
): string | null {
  const receipt = response.site_receipts?.[0];
  const candidates = [
    getRecordString(record, ['site_receipt_url', 'pdf_url', 'url_pdf']),
    response.site_receipt_url,
    response.pdf_url,
    receipt?.site_receipt_url,
    receipt?.pdf_url,
    receipt?.url,
  ];
  return candidates.find((candidate): candidate is string =>
    typeof candidate === 'string' && isHttpUrl(candidate.trim()),
  )?.trim() ?? null;
}

function getProviderErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const body = data as { code_message?: unknown; errors?: unknown };
    if (typeof body.code_message === 'string' && body.code_message.trim()) {
      return body.code_message.trim();
    }
    if (Array.isArray(body.errors)) {
      const message = body.errors
        .filter((error): error is string => typeof error === 'string')
        .join('; ');
      if (message) return message;
    }
  }
  return fallback;
}

export class InfoSimplesService {
  public isConfigured(): boolean {
    return Boolean(getStringEnv('INFOSIMPLES_TOKEN'));
  }

  public consultarCndFederal(cnpj: string): Promise<InfoSimplesResponse> {
    return this.consultar('/receita-federal/cnd', cnpj);
  }

  public consultarCrfFgts(cnpj: string): Promise<InfoSimplesResponse> {
    return this.consultar('/caixa/crf', cnpj);
  }

  public consultarCndt(cnpj: string): Promise<InfoSimplesResponse> {
    return this.consultar('/tst/cndt', cnpj);
  }

  public async sincronizarCertidoes(
    companyId: string,
    cnpj: string,
  ): Promise<InfoSimplesSyncResult> {
    const [federalResponse, fgtsResponse, cndtResponse] = await Promise.all([
      this.consultarCndFederal(cnpj),
      this.consultarCrfFgts(cnpj),
      this.consultarCndt(cnpj),
    ]);

    const responseMappings: Array<{
      type: SyncedCertificate['type'];
      response: InfoSimplesResponse<InfoSimplesCertificateRecord>;
    }> = [
      { type: 'RECEITA', response: federalResponse },
      { type: 'FGTS', response: fgtsResponse },
      { type: 'TRABALHISTA', response: cndtResponse },
    ];

    const mapped = responseMappings.map(({ type, response }) => {
      const record = response.data[0];
      if (!record) {
        throw new InfoSimplesError(
          `A InfoSimples não retornou dados para a certidão ${type}.`,
          'INFOSIMPLES_EMPTY_CERTIFICATE',
          502,
        );
      }

      const expirationValue = getRecordString(record, [
        'data_validade',
        'validade',
        'data_validade_certidao',
      ]);
      const expirationDate = parseExpirationDate(expirationValue);
      if (!expirationDate) {
        throw new InfoSimplesError(
          `A InfoSimples não retornou uma data de validade reconhecida para a certidão ${type}.`,
          'INFOSIMPLES_INVALID_EXPIRATION_DATE',
          502,
        );
      }

      const statusOriginal = getRecordString(record, ['status', 'situacao', 'regularidade']);
      return {
        type,
        expirationDate,
        statusOriginal,
        regularidade: mapRegularity(statusOriginal),
        documentUrl: getReceiptUrl(record, response),
      };
    });

    const savedCertificates = await prisma.$transaction(async (transaction) => {
      const saved = [];

      for (const certificate of mapped) {
        const existing = await transaction.companyCertificate.findFirst({
          where: { companyId, type: certificate.type },
          orderBy: { updatedAt: 'desc' },
        });
        const today = new Date();
        const daysRemaining = Math.ceil(
          (Date.UTC(
            certificate.expirationDate.getUTCFullYear(),
            certificate.expirationDate.getUTCMonth(),
            certificate.expirationDate.getUTCDate(),
          ) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
          / 86_400_000,
        );
        const expiryStatus = daysRemaining < 0
          ? 'EXPIRED'
          : daysRemaining <= 7
            ? 'WARNING'
            : 'VALID';
        const existingMetadata = existing?.metadata
          && typeof existing.metadata === 'object'
          && !Array.isArray(existing.metadata)
          ? existing.metadata as Prisma.InputJsonObject
          : {};
        const metadata = {
          ...existingMetadata,
          infosimples: {
            regularidade: certificate.regularidade,
            statusOriginal: certificate.statusOriginal,
            consultadoEm: new Date().toISOString(),
            provedor: 'INFOSIMPLES',
          },
        } as Prisma.InputJsonObject;
        const data = {
          expirationDate: certificate.expirationDate,
          status: expiryStatus,
          documentUrl: certificate.documentUrl || existing?.documentUrl || null,
          metadata,
        };

        saved.push(existing
          ? await transaction.companyCertificate.update({
              where: { id: existing.id },
              data,
            })
          : await transaction.companyCertificate.create({
              data: {
                ...data,
                companyId,
                type: certificate.type,
              },
            }));
      }

      return saved;
    });

    return {
      companyId,
      synchronizedAt: new Date().toISOString(),
      certificates: savedCertificates.map((saved) => {
        const providerData = saved.metadata
          && typeof saved.metadata === 'object'
          && !Array.isArray(saved.metadata)
          ? saved.metadata as Prisma.InputJsonObject
          : {};
        const infosimples = providerData.infosimples
          && typeof providerData.infosimples === 'object'
          && !Array.isArray(providerData.infosimples)
          ? providerData.infosimples as Prisma.InputJsonObject
          : {};
        const regularidade = infosimples.regularidade;
        return {
          type: saved.type as SyncedCertificate['type'],
          regularidade: regularidade === 'REGULAR' || regularidade === 'IRREGULAR'
            ? regularidade
            : 'NAO_IDENTIFICADA',
          statusOriginal: typeof infosimples.statusOriginal === 'string'
            ? infosimples.statusOriginal
            : null,
          expirationDate: saved.expirationDate.toISOString(),
          documentUrl: saved.documentUrl,
        };
      }),
    };
  }

  private async consultar(endpoint: string, cnpjValue: string): Promise<InfoSimplesResponse> {
    const token = getStringEnv('INFOSIMPLES_TOKEN');
    if (!token) {
      throw new InfoSimplesError(
        'A variável INFOSIMPLES_TOKEN não está configurada.',
        'INFOSIMPLES_TOKEN_NOT_CONFIGURED',
        503,
      );
    }

    const cnpj = validateCnpj(cnpjValue);
    const baseUrl = getStringEnv('INFOSIMPLES_API_BASE_URL', DEFAULT_BASE_URL).replace(/\/+$/, '');
    const timeout = Math.max(1000, getNumberEnv('INFOSIMPLES_TIMEOUT_MS', DEFAULT_TIMEOUT_MS));

    let responseData: unknown;
    try {
      const response = await axios.post(
        `${baseUrl}${endpoint}`,
        new URLSearchParams({ cnpj }).toString(),
        {
          params: { token },
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout,
          maxContentLength: MAX_RESPONSE_SIZE_BYTES,
          maxBodyLength: 1024 * 1024,
          maxRedirects: 0,
        },
      );
      responseData = response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      throw new InfoSimplesError(
        status
          ? `A InfoSimples retornou HTTP ${status} durante a consulta.`
          : 'Não foi possível concluir a consulta à InfoSimples.',
        status ? 'INFOSIMPLES_HTTP_ERROR' : 'INFOSIMPLES_CONNECTION_ERROR',
        status,
      );
    }

    if (
      !responseData
      || typeof responseData !== 'object'
      || !Number.isInteger((responseData as { code?: unknown }).code)
      || !Array.isArray((responseData as { data?: unknown }).data)
    ) {
      throw new InfoSimplesError(
        'A InfoSimples retornou uma resposta fora do formato esperado.',
        'INFOSIMPLES_INVALID_RESPONSE',
        502,
      );
    }

    const result = responseData as InfoSimplesResponse;
    if (result.code !== 200) {
      throw new InfoSimplesError(
        getProviderErrorMessage(result, 'A InfoSimples não concluiu a consulta.'),
        `INFOSIMPLES_PROVIDER_${result.code}`,
        502,
      );
    }

    return result;
  }
}

export const infosimplesService = new InfoSimplesService();

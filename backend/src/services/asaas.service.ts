import axios from 'axios';

export class AsaasConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsaasConfigError';
  }
}

export class AsaasWebhookAuthError extends Error {
  constructor(message = 'Token de webhook Asaas inválido.') {
    super(message);
    this.name = 'AsaasWebhookAuthError';
  }
}

function getAsaasBaseUrl(): string {
  let raw = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').trim();
  const mdMatch = raw.match(/\((https?:\/\/[^)]+)\)/);
  if (mdMatch) raw = mdMatch[1];
  raw = raw.replace(/^\[|\]$/g, '').replace(/\/+$/, '');
  return raw;
}

function getAsaasApiKey(): string {
  const key = (process.env.ASAAS_API_KEY || '').trim();
  if (!key) {
    throw new AsaasConfigError('ASAAS_API_KEY não configurada no servidor.');
  }
  return key;
}

function asaasClient() {
  return axios.create({
    baseURL: getAsaasBaseUrl(),
    timeout: 20000,
    headers: {
      access_token: getAsaasApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Expertise-Licitatoria/1.0',
    },
  });
}

export const asaasService = {
  isConfigured(): boolean {
    return Boolean((process.env.ASAAS_API_KEY || '').trim());
  },

  validateWebhookToken(headerToken?: string | string[]) {
    const expected = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (!expected) return; // Se nao configurado, aceita em modo permissivo ate configurar
    const received = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (!received || received.trim() !== expected) {
      throw new AsaasWebhookAuthError();
    }
  },

  async findOrCreateCustomer(input: { name: string; email: string; cpfCnpj: string; phone?: string }) {
    const client = asaasClient();
    const cpfCnpj = input.cpfCnpj.replace(/\D/g, '');
    const search = await client.get('/customers', { params: { cpfCnpj } });
    const existing = Array.isArray(search.data?.data) ? search.data.data[0] : null;
    if (existing?.id) return existing;

    const created = await client.post('/customers', {
      name: input.name,
      email: input.email,
      cpfCnpj,
      mobilePhone: input.phone ? input.phone.replace(/\D/g, '') : undefined,
      notificationDisabled: false,
    });
    return created.data;
  },

  async createSubscription(input: {
    customer: string;
    value: number;
    description: string;
    externalReference: string;
    nextDueDate: string;
    cycle?: 'MONTHLY' | 'YEARLY';
    billingType?: 'PIX' | 'CREDIT_CARD';
    successUrl?: string;
  }) {
    const client = asaasClient();
    const payload: Record<string, unknown> = {
      customer: input.customer,
      billingType: input.billingType || 'PIX',
      ...(input.billingType !== 'CREDIT_CARD' ? { pixAutomaticAuthorizationMode: 'OPTIONAL' } : {}),
      cycle: input.cycle || 'MONTHLY',
      value: input.value,
      nextDueDate: input.nextDueDate,
      description: input.description,
      externalReference: input.externalReference,
    };
    // callback.successUrl omitido para nao exigir configuracao previa de website no Asaas
    const res = await client.post('/subscriptions', payload);
    return res.data;
  },

  async getFirstPaymentUrl(subscriptionId: string): Promise<string | null> {
    const client = asaasClient();
    const res = await client.get(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
    const payments = Array.isArray(res.data?.data) ? res.data.data : [];
    const first = payments[0];
    return first?.invoiceUrl || first?.bankSlipUrl || null;
  },

  async getSubscription(subscriptionId: string) {
    const client = asaasClient();
    const res = await client.get(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
    return res.data;
  },

  async getSubscriptionPayments(subscriptionId: string) {
    const client = asaasClient();
    const res = await client.get(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },
};

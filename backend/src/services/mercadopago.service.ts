import {
  InvalidWebhookSignatureError,
  Invoice,
  MercadoPagoConfig,
  PreApproval,
  WebhookSignatureValidator,
} from 'mercadopago';

interface SubscriptionCreationBody {
  preapproval_plan_id: string;
  payer_email: string;
  external_reference: string;
  back_url: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'months';
    transaction_amount: number;
    currency_id: 'BRL';
  };
}

interface WebhookSignature {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}

export class MercadoPagoService {
  private client: MercadoPagoConfig | null = null;

  private getClient(): MercadoPagoConfig {
    if (!this.client) {
      const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
      if (!accessToken) {
        throw new Error('MP_ACCESS_TOKEN nao configurado');
      }

      this.client = new MercadoPagoConfig({ accessToken });
    }

    return this.client;
  }

  createSubscription(body: SubscriptionCreationBody) {
    return new PreApproval(this.getClient()).create({ body });
  }

  getSubscription(id: string) {
    return new PreApproval(this.getClient()).get({ id });
  }

  getAuthorizedPayment(id: string) {
    return new Invoice(this.getClient()).get({ id });
  }

  validateWebhookSignature(signature: WebhookSignature): void {
    WebhookSignatureValidator.validate(signature);
  }

  isInvalidWebhookSignature(error: unknown): boolean {
    return error instanceof InvalidWebhookSignatureError;
  }
}

export const mercadoPagoService = new MercadoPagoService();

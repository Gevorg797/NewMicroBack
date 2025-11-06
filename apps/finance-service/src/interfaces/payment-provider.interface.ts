/**
 * Core interfaces for payment provider abstraction
 */

export interface PaymentPayload {
  transactionId: number;
  amount: number;
  params?: Record<string, any>;
}

export interface PayoutPayload extends PaymentPayload {
  requisite?: string;
  to?: string;
}

export interface CallbackPayload {
  body: any;
  headers?: any;
  params?: Record<string, any>;
}

export interface ProviderSettings {
  baseURL: string;
  publicKey?: string;
  privateKey?: string;
  apiKey?: string;
  shopId?: string;
  providerId: number;
}

export interface PaymentResult {
  paymentUrl?: string;
  invoiceId?: string;
  data?: any;
  error?: string;
}

/**
 * Abstract interface that all payment providers must implement
 */
export interface IPaymentProvider {
  /**
   * Create a payin (deposit) order
   */
  createPayinOrder(payload: PaymentPayload): Promise<PaymentResult>;

  /**
   * Create a payout (withdrawal) process
   */
  createPayoutProcess(payload: PayoutPayload): Promise<any>;

  /**
   * Handle payment callback/webhook
   */
  handleCallback(payload: CallbackPayload): Promise<void>;
}

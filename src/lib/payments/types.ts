// Tipos e contrato da camada de pagamento.
//
// O restante do sistema depende APENAS desta interface. Para plugar um
// gateway real (Mercado Pago, Stripe, Pagar.me, ...), basta implementar
// um novo PaymentProvider e trocar a factory em payments/index.ts —
// nenhuma outra parte do código precisa mudar.

export type PaymentStatus = "pending" | "approved" | "rejected";

export interface PaymentCustomer {
  name: string;
  email: string;
}

export interface CreatePaymentInput {
  /** Valor total em centavos */
  amountCents: number;
  description: string;
  customer: PaymentCustomer;
  /** Id do pedido no nosso sistema */
  orderId: string;
}

export interface PaymentInfo {
  /** Id do pagamento no provedor */
  paymentId: string;
  status: PaymentStatus;
  /** Nome do provedor (ex.: "mock", "mercadopago") */
  provider: string;
  /**
   * Campos específicos do gateway (opcional).
   * No mock, trazemos um "código Pix" fake para demonstrar o fluxo.
   */
  gatewayData?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentInfo>;
  getStatus(paymentId: string): Promise<PaymentStatus>;
  /**
   * Dados completos de um pagamento já criado (opcional — usado pela
   * página de acompanhamento para reexibir o código Pix, por exemplo).
   */
  getInfo?(paymentId: string): Promise<PaymentInfo | null>;
  /**
   * Aprovação manual — usada APENAS pelo provedor mock para simular o
   * webhook de confirmação de um gateway real. Gateways reais confirmam
   * via webhook assíncrono; o mock expõe isso para fins de demonstração.
   */
  approve?(paymentId: string): Promise<PaymentStatus>;
}

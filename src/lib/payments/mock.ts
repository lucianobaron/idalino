import { randomUUID } from "crypto";
import type {
  CreatePaymentInput,
  PaymentInfo,
  PaymentProvider,
  PaymentStatus,
} from "./types";

interface MockPaymentRecord {
  id: string;
  input: CreatePaymentInput;
  status: PaymentStatus;
  createdAt: Date;
}

// Estado compartilhado no nível do módulo: garante que todas as
// instâncias (rotas API, páginas, etc.) enxerguem os mesmos pagamentos.
const payments = new Map<string, MockPaymentRecord>();

/**
 * Provedor de pagamento MOCK para desenvolvimento.
 *
 * Simula o ciclo completo: cria um "pagamento" com status pending,
 * gera um código Pix fake e permite aprovar manualmente (simulando o
 * webhook de confirmação). Não toca em nenhum gateway real.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createPayment(input: CreatePaymentInput): Promise<PaymentInfo> {
    // Pequeno delay para simular latência de rede do gateway
    await new Promise((resolve) => setTimeout(resolve, 600));

    const id = `mock-${randomUUID()}`;
    payments.set(id, {
      id,
      input,
      status: "pending",
      createdAt: new Date(),
    });

    return this.buildInfo(id);
  }

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    return payments.get(paymentId)?.status ?? "rejected";
  }

  async getInfo(paymentId: string): Promise<PaymentInfo | null> {
    const record = payments.get(paymentId);
    if (!record) return null;
    return this.buildInfo(record.id);
  }

  /** Aprova o pagamento manualmente (simula o webhook do gateway). */
  async approve(paymentId: string): Promise<PaymentStatus> {
    const record = payments.get(paymentId);
    if (!record) return "rejected";
    record.status = "approved";
    return "approved";
  }

  private buildInfo(id: string): PaymentInfo {
    const record = payments.get(id)!;
    return {
      paymentId: id,
      status: record.status,
      provider: this.name,
      gatewayData: {
        pixCode: this.buildFakePixCode(id),
        instructions:
          "MOCK — Pagamento simulado. Nenhuma cobrança real será feita. Use o botão 'Simular pagamento' para aprovar.",
      },
    };
  }

  private buildFakePixCode(id: string): string {
    // Estrutura apenas ilustrativa de um código Pix de copia-e-cola
    return `00020126580014BR.GOV.BCB.PIX0136${id.replace(/-/g, "")}520400005303986540689.905802BR5909IDALINO6009SAO PAULO6304A1B2`;
  }
}

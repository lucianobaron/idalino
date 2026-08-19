import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

// Singleton por provedor (estado em memória do mock deve ser compartilhado)
const instances = new Map<string, PaymentProvider>();

/**
 * Factory da camada de pagamento.
 *
 * Selecione o provedor pela variável de ambiente PAYMENT_PROVIDER.
 * Hoje só existe o "mock"; quando o gateway real for contratado,
 * adicione aqui, ex.:
 *
 *   case "mercadopago": return new MercadoPagoProvider(...);
 */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";

  const cached = instances.get(name);
  if (cached) return cached;

  let provider: PaymentProvider;
  switch (name) {
    case "mock":
      provider = new MockPaymentProvider();
      break;
    default:
      throw new Error(
        `Provedor de pagamento desconhecido: "${name}". Use "mock".`,
      );
  }

  instances.set(name, provider);
  return provider;
}

import 'server-only';
import type { MoneyString } from '@/lib/money';

/**
 * Payment abstraction.
 *
 * BOA has not named an online gateway yet, so rather than invent one this
 * module defines the contract an integration must satisfy and ships the three
 * providers that need no integration at all: cash on delivery, cash on pickup
 * and bank transfer. Adding Konnect, Flouci or Paymee later means writing one
 * file that implements `PaymentProvider` and listing its key in
 * PAYMENT_PROVIDERS — no schema change, no checkout rewrite.
 *
 * No provider in this codebase ever receives, stores or logs card data. An
 * online provider returns a redirect URL and confirms out of band by webhook.
 */
export type PaymentIntent = {
  orderId: string;
  orderReference: string;
  amount: MoneyString;
  currency: 'TND';
  customerEmail: string;
  locale: 'FR' | 'EN' | 'AR';
  returnUrl: string;
};

export type PaymentInitResult =
  | { kind: 'no_action'; providerRef: string | null }
  | { kind: 'redirect'; url: string; providerRef: string };

export type WebhookVerification =
  | { ok: true; externalId: string; orderReference: string; status: 'PAID' | 'FAILED' | 'CANCELLED'; providerRef: string }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly key: string;
  readonly method: 'CASH_ON_DELIVERY' | 'CASH_ON_PICKUP' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY';
  /** Whether this provider can be offered for the chosen fulfilment method. */
  supports(fulfilment: 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP'): boolean;
  /** Called inside order creation. Must not have side effects that cannot be retried. */
  initiate(intent: PaymentIntent): Promise<PaymentInitResult>;
  /**
   * Verifies a provider callback. Implementations MUST check a signature and
   * MUST be safe to call twice with the same payload — `webhook_events` gives
   * de-duplication, but the verification itself has to be pure.
   */
  verifyWebhook?(rawBody: string, headers: Record<string, string>): Promise<WebhookVerification>;
}

class OfflineProvider implements PaymentProvider {
  constructor(
    readonly key: string,
    readonly method: PaymentProvider['method'],
    private readonly fulfilments: ReadonlyArray<'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP'>,
  ) {}

  supports(fulfilment: 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP'): boolean {
    return this.fulfilments.includes(fulfilment);
  }

  async initiate(): Promise<PaymentInitResult> {
    // Nothing to charge online. The order is created UNPAID and BOA collects on
    // delivery, at pickup, or reconciles the transfer by hand.
    return { kind: 'no_action', providerRef: null };
  }
}

/** Cash handed to the courier. Not offered for store pickup — there is no courier. */
export const cashOnDelivery = new OfflineProvider('cod', 'CASH_ON_DELIVERY', ['DELIVERY', 'HAND_TO_HAND']);

/** Cash at the counter. Only meaningful when the customer collects. */
export const cashOnPickup = new OfflineProvider('cop', 'CASH_ON_PICKUP', ['STORE_PICKUP']);

/** Bank transfer works for every fulfilment method; BOA reconciles manually. */
export const bankTransfer = new OfflineProvider('bank_transfer', 'BANK_TRANSFER', [
  'DELIVERY',
  'HAND_TO_HAND',
  'STORE_PICKUP',
]);

const REGISTRY = new Map<string, PaymentProvider>([
  [cashOnDelivery.key, cashOnDelivery],
  [cashOnPickup.key, cashOnPickup],
  [bankTransfer.key, bankTransfer],
]);

/** Registration point for a real gateway, called once at module load if configured. */
export function registerProvider(provider: PaymentProvider): void {
  REGISTRY.set(provider.key, provider);
}

export function getProvider(key: string): PaymentProvider | null {
  return REGISTRY.get(key) ?? null;
}

export function availableProviders(
  enabledKeys: string[],
  fulfilment: 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP',
): PaymentProvider[] {
  return enabledKeys
    .map((key) => REGISTRY.get(key))
    .filter((provider): provider is PaymentProvider => Boolean(provider))
    .filter((provider) => provider.supports(fulfilment));
}

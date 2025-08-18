export interface CreditAccount {
  orgId: string;
  balanceCents: number;
  dailyGasCapCents: number;
  dailyGasSpendCents: number;
  spendWindowStart?: string | null;
  currency: string;
}

export interface CreditTransaction {
  id: string;
  orgId: string;
  amountCents: number;
  type: 'issue'|'debit'|'refund'|'hold'|'release'|'chargeback';
  reason?: string;
  refType?: string;
  refId?: string;
  provider?: string;
  providerRef?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface FxSnapshot {
  ethUsdCents: number; // cents per ETH
  rateId?: string;
  takenAt: string;
}

export interface CreditsService {
  topUpCredits(orgId: string, amountCents: number, provider?: string, providerRef?: string, idempotencyKey?: string): Promise<CreditTransaction>;
  debitCredits(orgId: string, amountCents: number, reason?: string, idempotencyKey?: string): Promise<CreditTransaction>;
  getBalance(orgId: string): Promise<CreditAccount | null>;
  holdCredits(orgId: string, approvalId: string, amountCents: number, method?: string, paramsHash?: string, fxSnapshot?: FxSnapshot, expiresAt?: string): Promise<{ holdId: string; txn: CreditTransaction }> ;
  releaseHold(orgId: string, approvalId: string, capture?: boolean, actualDebitCents?: number): Promise<CreditTransaction | null>;
}

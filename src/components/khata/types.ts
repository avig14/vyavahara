import type {
  Ageing,
  KhataAccount,
  KhataOverview,
} from "@/lib/analytics/khata-risk";
import type { Customer, KhataEntry } from "@/lib/domain";

/** JSON turns Date into an ISO string. */
type Json<T, K extends keyof T> = Omit<T, K> & { [P in K]: string | null };

export type AccountJson = Json<KhataAccount, "lastCreditAt" | "lastPaymentAt">;
export type OverviewJson = Omit<KhataOverview, "accounts"> & {
  accounts: AccountJson[];
};

/** GET /api/dashboard/khata */
export interface KhataResponse {
  khata: OverviewJson;
}

export type EntryJson = Omit<KhataEntry, "createdAt"> & { createdAt: string };
export type CustomerJson = Omit<Customer, "createdAt"> & { createdAt: string };

/** GET /api/dashboard/khata?customerId= */
export interface LedgerResponse {
  customer: CustomerJson;
  account: AccountJson | null;
  /** newest first */
  ledger: EntryJson[];
}

/** POST /api/pay */
export interface PayLinkResponse {
  url: string;
  token: string;
  amountPaise: number;
}

export type { Ageing };

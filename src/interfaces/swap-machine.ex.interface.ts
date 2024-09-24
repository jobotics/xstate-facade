import { Intent, SolverQuote } from "./swap-machine.in.interface";

// TODO : refactor this description
/**
 * External interfaces for communication with xstate-facade.
 * It is assumed that all other swap-machines will have adapters from internal to external interfaces.
 *
 * Additional Notes:
 * - Input - abstract swap data model for UI adaptation.
 * - Asset - abstract element of asset list for UI adaptation.
 * - AssetList - abstract list of assets aim for UI adaptation.
 * - IntentState - abstract state swap changes for UI adaptation.
 * - SwapProgressEnum - abstract statuses enum for UI adaptation.
 * - Context - abstract getter of intent state for UI adaptation.
 * - Quote - abstract quoting data model for UI adaptation.
 * - QuoteList - abstract quoted list for UI adaptation.
 */

export interface Context {
  intent: Partial<Intent>;
  quotes: Quote[];
  bestQuote: Quote | null;
}

export type Events = {
  type: "APPROVE_QUOTE";
  data?: { bestQuote: Quote; proof: string; quotes: Quote[] };
  output?: SolverQuote[];
};

export type Input = {
  assetIn?: string;
  assetOut?: string;
  amountIn?: string;
  intentId?: string;
};
export interface QuoteParams {
  assetIn: string;
  assetOut: string;
  amountIn: string;
}

export type Quote = SolverQuote;

export type TransactionEntity = {
  hash: string;
};

import { Intent, SwapProgressEnum } from "./swap-machine.in.interfaces";

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

export type Context = {
  intent: Intent;
  state: SwapProgressEnum;
  quotes: Quote[];
};

export type Events =
  | { type: "FETCH_QUOTE" }
  | { type: "FETCH_QUOTE_SUCCESS"; data: { quotes: Quote[] } }
  | { type: "FETCH_QUOTE_ERROR" }
  | { type: "SUBMIT_SWAP"; intent: Intent }
  | { type: "SUBMIT_SWAP_SUCCESS"; data: { callData: any } }
  | { type: "SUBMIT_SWAP_ERROR" }
  | { type: "CONFIRM_SWAP" }
  | { type: "CONFIRM_SWAP_SUCCESS" }
  | { type: "CONFIRM_SWAP_ERROR" }
  | { type: "QUOTE_EXPIRED" }
  | { type: "RETRY_INTENT"; intent: Intent }
  | { type: "SET_INTENT"; intent: Partial<Intent> };

export type Input = {
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  accountId: string;
  referral?: string;
  // Next entities aim for cross-swap
  solverId?: string;
  accountFrom?: string;
  accountTo?: string;
  // Next entities aim for time execution
  expiration?: number;
  lockup?: number;
};
export interface QuoteParams {
  assetIn: string;
  assetOut: string;
  amountIn: string;
}

export type Quote = {
  solverId: string;
  amountOut: string;
};

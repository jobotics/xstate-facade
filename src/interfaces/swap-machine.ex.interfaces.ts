import { Intent, SwapProgressEnum } from "./swap-machine.in.interfaces";

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
};

export type Events =
  | { type: "FETCH_QUOTE"; intentId: string }
  | { type: "FETCH_QUOTE_SUCCESS"; intentId: string }
  | { type: "FETCH_QUOTE_ERROR"; intentId: string }
  | { type: "SUBMIT_SWAP"; intentId: string }
  | { type: "SUBMIT_SWAP_SUCCESS"; intentId: string }
  | { type: "SUBMIT_SWAP_ERROR"; intentId: string }
  | { type: "CONFIRM_SWAP"; intentId: string }
  | { type: "CONFIRM_SWAP_SUCCESS"; intentId: string }
  | { type: "CONFIRM_SWAP_ERROR"; intentId: string }
  | { type: "QUOTE_EXPIRED"; intentId: string }
  | { type: "RETRY_INTENT"; intentId: string }
  | { type: "SET_INTENT"; intent: Partial<Intent> };

export type Input = {
  assetIn: Asset;
  assetOut: Asset;
  amountIn: string;
  amountOut: string;
  accountId: string;
  // Next entities aim for cross-swap
  solverId?: string;
  accountFrom?: string;
  accountTo?: string;
  // Next entities aim for time execution
  expiration?: number;
  lockup?: boolean;
};

export type Asset = {
  defuseAssetId: string;
  decimals: number;
  assetName: string;
  metadataLink: string;
  routes: string[];
};
export interface QuoteParams {
  defuseAssetIdEntifierIn: string;
  defuseAssetIdEntifierOut: string;
  amountIn: string;
  intentType: string;
}

export type AssetList = Asset[];

export type QuoteList = {
  solverId: string;
  amountOut: string;
}[];

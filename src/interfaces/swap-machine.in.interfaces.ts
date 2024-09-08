/**
 * Internal interfaces, for describing types inside swap-machines and not exposed out.
 */

import { IntentState } from "./swap-machine.ex.interfaces";

export interface HttpResponse<T> {
  result: T;
}

export interface NearHttpResponse<T> extends HttpResponse<{ result: T }> {
  result: {
    result: T;
  };
}

export enum SwapStatusEnum {
  Available = "available",
  Completed = "Completed",
  Executed = "executed",
  RolledBack = "rolled_back",
}

export enum AssetTypeEnum {
  nep141 = "nep141",
  native = "native",
  cross_chain = "cross_chain",
}

export type BackupIntent = {
  intentId: string;
};

export type Intent = {
  intentId: string;
  initiator: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  expiration?: number;
  lockup?: number;
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
  | { type: "SET_INTENT"; intent: Partial<IntentState> };

export type AbstractAsset = {
  type: AssetTypeEnum;
  oracle?: string;
  asset?: string;
  token?: string;
};

export type IntentDetails = {
  asset_in: {
    amount: string;
    account: string;
  } & AbstractAsset;
  asset_out: {
    amount: string;
    account: string;
  } & AbstractAsset;
  lockup_until: {
    block_number: number;
  };
  expiration: {
    block_number: number;
  };
  status: SwapStatusEnum;
  referral: string;
  proof: string;
};

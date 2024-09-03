/**
 * Internal interfaces, for describing types inside swap-machines and not exposed out.
 */

import { IntentState } from "./swap-machine.ex.interfaces";

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

export type Intent =
  | {
      intentID: string;
      initiator: string;
      assetIn: string;
      assetOut: string;
      amountIn: string;
      amountOut: string;
      expiration?: number;
      lockup?: number;
    }
  | string;

export type Events =
  | { type: "FETCH_QUOTE"; intentID: string }
  | { type: "FETCH_QUOTE_SUCCESS"; intentID: string }
  | { type: "FETCH_QUOTE_ERROR"; intentID: string }
  | { type: "SUBMIT_SWAP"; intentID: string }
  | { type: "SUBMIT_SWAP_SUCCESS"; intentID: string }
  | { type: "SUBMIT_SWAP_ERROR"; intentID: string }
  | { type: "CONFIRM_SWAP"; intentID: string }
  | { type: "CONFIRM_SWAP_SUCCESS"; intentID: string }
  | { type: "CONFIRM_SWAP_ERROR"; intentID: string }
  | { type: "QUOTE_EXPIRED"; intentID: string }
  | { type: "RETRY_INTENT"; intentID: string }
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
};

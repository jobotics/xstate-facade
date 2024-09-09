/**
 * Internal interfaces, for describing types inside swap-machines and not exposed out.
 */

export interface HttpResponse<T> {
  result: T;
}

export interface NearHttpResponse<T> extends HttpResponse<{ result: T }> {
  result: {
    result: T;
  };
}

export enum SwapProgressEnum {
  Idle = "Idle",
  Quoting = "Quoting",
  Quoted = "Quoted",
  Submitting = "Submitting",
  Submitted = "Submitted",
  Confirming = "Confirming",
  Confirmed = "Confirmed",
  Failed = "Failed",
}

export enum SwapStatusEnum {
  Available = "available",
  Executed = "executed",
  RolledBack = "rolled_back",
}

export enum AssetTypeEnum {
  nep141 = "nep141",
  native = "native",
  cross_chain = "cross_chain",
}

export type Intent = {
  intentId: string;
  initiator: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  expiration?: number;
  lockup?: number;
  status?: SwapStatusEnum;
  proof?: string;
  referral?: string;
};

export type AbstractAsset = {
  type: AssetTypeEnum;
  oracle?: string;
  asset?: string;
  token?: string;
};

export type Asset = {
  defuseAssetId: string;
  decimals: number;
  assetName: string;
  metadataLink: string;
  routes: string[];
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

export interface SolverQuote {
  solver_id: string;
  amount_out: string;
}

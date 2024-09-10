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
  Failing = "Failing",
  Failed = "Failed",
}

export enum SwapStatusEnum {
  Available = "available",
  Executed = "executed",
  RolledBack = "rolled_back",
}

export enum AssetTypeEnum {
  Unknown = "unknown",
  Nep141 = "nep141",
  Native = "native",
  CrossChain = "cross_chain",
}

export enum MapsNetworkEnum {
  NearMainnet = "near:mainnet",
  EthBase = "eth:8453",
  BtcMainnet = "btc:mainnet",
}

export enum TransactionMethodEnum {
  NativeOnTransfer = "native_on_transfer",
  FtTransferCall = "ft_transfer_call",
  RollbackIntent = "rollback_intent",
}

export enum IntentCreateTypeEnum {
  Create = "create",
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
  type: AssetTypeEnum.Nep141 | AssetTypeEnum.Native | AssetTypeEnum.CrossChain;
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

export type ParseDefuseAssetResult = {
  blockchain: string;
  network: string;
  contractId: string;
} | null;

export type SubmitIntentResult = {
  callData: PrepareTxSingleChainResult | PrepareTxCrossChainResult;
} | null;

export type PrepareTxSingleChainResult = {
  receiverId: string;
  actions: {
    type: string;
    params:
      | {
          methodName: TransactionMethodEnum;
          args: {
            msg: string;
          };
          gas: string;
          deposit: string;
        }
      | {
          receiver_id: string;
          amount: string;
          memo: string;
          msg: string;
          gas: string;
          deposit: string;
        };
  }[];
};

export type PrepareTxCrossChainResult = {
  receiverId: string;
  actions: {
    type: string;
    params:
      | {
          methodName: TransactionMethodEnum.NativeOnTransfer;
          args: {
            msg: string;
          };
          gas: string;
          deposit: string;
        }
      | {
          methodName: TransactionMethodEnum.FtTransferCall;
          args: {
            receiver_id: string;
            amount: string;
            memo: string;
            msg: string;
          };
          gas: string;
          deposit: string;
        };
  }[];
};

export interface IntentCreateMsg {
  type: IntentCreateTypeEnum.Create;
  id: string;
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
  referral: string;
}

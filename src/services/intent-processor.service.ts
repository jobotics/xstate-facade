import {
  AssetTypeEnum,
  IntentCreateTypeEnum,
  IntentCreateMsg,
  PrepareTxCrossChainResult,
  PrepareTxSingleChainResult,
  SolverQuote,
  SubmitIntentResult,
  SwapProgressEnum,
  SwapStatusEnum,
  TransactionMethodEnum,
} from "../interfaces/swap-machine.in.interface";
import {
  mapAssetKey,
  mapCreateIntentTransactionCall,
} from "../maps/swap-transition.map";
import {
  Context,
  Input,
  QuoteParams,
} from "../interfaces/swap-machine.ex.interface";
import { ApiService } from "./api.service";
import parseDefuseAsset, { generateIntentId } from "../utils/utils";
import Ajv from "ajv";
import {
  msgSchemaCreateIntentCrossChain,
  msgSchemaCreateIntentSingleChain,
} from "../schemes/json-validaton.schema";
import { MAX_GAS_TRANSACTION, PROTOCOL_ID } from "../constants/constants";

export class IntentProcessorService {
  constructor(private readonly apiService: ApiService) {}

  private initializeProgressStatusAdapter(
    status: SwapStatusEnum,
  ): SwapProgressEnum {
    switch (status) {
      case SwapStatusEnum.Available:
        return SwapProgressEnum.Swapping;
      case SwapStatusEnum.Executed:
        return SwapProgressEnum.Confirming;
      case SwapStatusEnum.RolledBack:
        return SwapProgressEnum.Failed;
      default:
        return SwapProgressEnum.Failed;
    }
  }

  static prepareTxSingleChain(
    intent: Input,
  ): PrepareTxSingleChainResult | null {
    const from = parseDefuseAsset(intent.assetIn);
    const contractIdTokenIn = from!.contractId;
    const to = parseDefuseAsset(intent.assetOut);
    const contractIdTokenOut = to!.contractId;

    const receiverIdIn = from!.contractId;
    const unitsSendAmount = intent.amountIn;
    const estimateUnitsBackAmount = intent.amountOut;

    const msg: IntentCreateMsg = {
      type: IntentCreateTypeEnum.Create,
      id: generateIntentId(),
      asset_out: {
        type:
          contractIdTokenOut === AssetTypeEnum.Native
            ? AssetTypeEnum.Native
            : AssetTypeEnum.Nep141,
        token: contractIdTokenOut,
        amount: estimateUnitsBackAmount,
        account: intent?.accountTo
          ? (intent.accountTo ?? "")
          : (intent.accountId ?? ""),
      },
      lockup_until: {
        block_number: intent!.lockup ?? 0,
      },
      expiration: {
        block_number: intent!.expiration ?? 0,
      },
      referral: intent!.referral ?? "",
    };

    const ajv = new Ajv();
    const validate = ajv.compile(msgSchemaCreateIntentSingleChain);
    const isValid = validate(msg);
    if (!isValid) {
      console.log("Validation errors:", validate.errors);
      return null;
    }

    const params = {} as PrepareTxSingleChainResult["actions"][0]["params"];
    if (contractIdTokenIn === AssetTypeEnum.Native) {
      Object.assign(params, {
        methodName: TransactionMethodEnum.NativeOnTransfer,
        args: {
          msg: JSON.stringify(msg),
        },
        gas: MAX_GAS_TRANSACTION,
        deposit: unitsSendAmount,
      });
    } else {
      Object.assign(params, {
        methodName: TransactionMethodEnum.FtTransferCall,
        args: {
          receiver_id: PROTOCOL_ID,
          amount: unitsSendAmount,
          memo: "Execute intent: NEP-141 to NEP-141",
          msg: JSON.stringify(msg),
        },
        gas: MAX_GAS_TRANSACTION,
        deposit: "1",
      });
    }

    return {
      receiverId:
        contractIdTokenIn === AssetTypeEnum.Native ? PROTOCOL_ID : receiverIdIn,
      actions: [
        {
          type: "FunctionCall",
          params,
        },
      ],
    };
  }

  static prepareTxCrossChain(intent: Input): PrepareTxCrossChainResult | null {
    const from = parseDefuseAsset(intent.assetIn);
    const contractIdTokenIn = from!.contractId;
    const to = parseDefuseAsset(intent.assetOut);
    const contractIdTokenOut = to!.contractId;

    const receiverIdIn = from!.contractId;
    const unitsSendAmount = intent.amountIn;
    const estimateUnitsBackAmount = intent.amountOut;

    const msg: IntentCreateMsg = {
      type: IntentCreateTypeEnum.Create,
      id: generateIntentId(),
      asset_out: {
        type: AssetTypeEnum.CrossChain,
        oracle: intent?.solverId ?? "",
        asset: contractIdTokenOut,
        amount: estimateUnitsBackAmount,
        account: intent.accountTo ?? "",
      },
      lockup_until: {
        block_number: intent!.lockup ?? 0,
      },
      expiration: {
        block_number: intent!.expiration ?? 0,
      },
      referral: intent!.referral ?? "",
    };

    const ajv = new Ajv();
    const validate = ajv.compile(msgSchemaCreateIntentCrossChain);
    const isValid = validate(msg);
    if (!isValid) {
      console.log("Validation errors:", validate.errors);
      throw new Error(`Validation schema errors`);
    }

    const params = {} as PrepareTxCrossChainResult["actions"][0]["params"];
    if (contractIdTokenIn === AssetTypeEnum.Native) {
      Object.assign(params, {
        methodName: TransactionMethodEnum.NativeOnTransfer,
        args: {
          msg: JSON.stringify(msg),
        },
        gas: MAX_GAS_TRANSACTION,
        deposit: unitsSendAmount,
      });
    } else {
      Object.assign(params, {
        methodName: TransactionMethodEnum.FtTransferCall,
        args: {
          receiver_id: PROTOCOL_ID,
          amount: unitsSendAmount,
          memo: `Execute intent: ${intent.assetIn} to ${intent.assetOut}`,
          msg: JSON.stringify(msg),
        },
        gas: MAX_GAS_TRANSACTION,
        deposit: "1",
      });
    }

    return {
      receiverId:
        contractIdTokenIn === AssetTypeEnum.Native ? PROTOCOL_ID : receiverIdIn,
      actions: [
        {
          type: "FunctionCall",
          params,
        },
      ],
    };
  }

  async initialize(intentId: string): Promise<Context | null> {
    const intent = await this.fetchIntent(intentId);
    if (!intent) {
      return null;
    }
    return {
      intent,
      state: this.initializeProgressStatusAdapter(
        intent.status as SwapStatusEnum,
      ),
      quotes: [],
    };
  }

  async fetchQuotes(params: QuoteParams): Promise<SolverQuote[]> {
    const quotes = await this.apiService.getQuotes(params);
    return quotes;
  }

  async prepareSwapCallData(intent: Input): Promise<SubmitIntentResult> {
    const callData = mapCreateIntentTransactionCall(intent);
    if (callData) {
      return callData;
    }
    return null;
  }

  async readTransaction(hash: string): Promise<Context["intent"] | null> {
    return null;
  }

  async callRollbackIntent(
    intentId: string,
  ): Promise<Context["intent"] | null> {
    return null;
  }

  async fetchIntent(intentId: string): Promise<Context["intent"] | null> {
    const intentDetails = await this.apiService.getIntent(intentId);
    const assetIn =
      intentDetails?.asset_in?.asset ??
      mapAssetKey(
        intentDetails?.asset_in?.type ?? AssetTypeEnum.Unknown,
        intentDetails?.asset_in?.token as string,
      );
    const assetOut =
      intentDetails?.asset_out?.asset ??
      mapAssetKey(
        intentDetails?.asset_out?.type ?? AssetTypeEnum.Unknown,
        intentDetails?.asset_out?.token as string,
      );

    if (!intentDetails || !assetIn || !assetOut) {
      console.log("No intent details found");
      return null;
    }

    return {
      intentId,
      initiator: intentDetails.asset_in.account,
      assetIn,
      assetOut,
      amountIn: intentDetails.asset_in.amount,
      amountOut: intentDetails.asset_out.amount,
      expiration: intentDetails.expiration.block_number,
      lockup: intentDetails.lockup_until.block_number,
      status: intentDetails.status,
    };
  }
}

import {
  SolverQuote,
  SwapProgressEnum,
  SwapStatusEnum,
} from "../interfaces/swap-machine.in.interfaces";
import { mapAssetKey } from "../maps/maps";
import {
  Context,
  QuoteParams,
} from "src/interfaces/swap-machine.ex.interfaces";
import { ApiService } from "./api.service";

export class IntentProcessorService {
  constructor(private readonly apiService: ApiService) {}

  private initializeProgressStatusAdapter(
    status: SwapStatusEnum,
  ): SwapProgressEnum {
    switch (status) {
      case SwapStatusEnum.Available:
        return SwapProgressEnum.Confirming;
      case SwapStatusEnum.Executed:
        return SwapProgressEnum.Confirmed;
      case SwapStatusEnum.RolledBack:
        return SwapProgressEnum.Failed;
      default:
        return SwapProgressEnum.Idle;
    }
  }

  async initialize(intentId: string): Promise<Context | null> {
    const intentDetails = await this.apiService.getIntent(intentId);
    if (!intentDetails) {
      console.log("No intent details found");
      return null;
    }
    const intent = {
      intentId,
      initiator: intentDetails.asset_in.account,
      assetIn:
        intentDetails.asset_in?.asset ??
        mapAssetKey(
          intentDetails.asset_in.type,
          intentDetails.asset_in!.token as string,
        ),
      assetOut:
        intentDetails.asset_out?.asset ??
        mapAssetKey(
          intentDetails.asset_out.type,
          intentDetails.asset_out!.token as string,
        ),
      amountIn: intentDetails.asset_in.amount,
      amountOut: intentDetails.asset_out.amount,
      expiration: intentDetails.expiration.block_number,
      lockup: intentDetails.lockup_until.block_number,
      status: intentDetails.status,
    };
    return {
      intent,
      state: this.initializeProgressStatusAdapter(intentDetails.status),
    };
  }

  async fetchQuotes(params: QuoteParams): Promise<SolverQuote[]> {
    const quotes = await this.apiService.getQuotes(params);
    return quotes;
  }

  next(state: SwapProgressEnum): SwapProgressEnum {
    switch (state) {
      case SwapProgressEnum.Idle:
        return SwapProgressEnum.Quoting;
      case SwapProgressEnum.Quoting:
        return SwapProgressEnum.Quoted;
      case SwapProgressEnum.Quoted:
        return SwapProgressEnum.Submitting;
      case SwapProgressEnum.Submitting:
        return SwapProgressEnum.Submitted;
      case SwapProgressEnum.Submitted:
        return SwapProgressEnum.Confirming;
      case SwapProgressEnum.Confirming:
        return SwapProgressEnum.Confirmed;
      case SwapProgressEnum.Failed:
        return SwapProgressEnum.Submitting;
      default:
        return SwapProgressEnum.Idle;
    }
  }
}

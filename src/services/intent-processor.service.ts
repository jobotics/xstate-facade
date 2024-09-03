import { HttpService } from "./http.service";
import { Buffer } from "buffer";
import {
  Intent,
  IntentDetails,
} from "../interfaces/swap-machine.in.interfaces";
import { mapAssetKey } from "../maps/maps";

const rpc = "https://nearrpc.aurora.dev";
const protocolID = "swap-defuse.near";

export class IntentProcessorService {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  private async getIntent(intentID: string): Promise<IntentDetails | null> {
    try {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "query",
        params: {
          request_type: "call_function",
          account_id: protocolID,
          method_name: "get_intent",
          args_base64: Buffer.from(JSON.stringify({ id: intentID })).toString(
            "base64",
          ),
          finality: "final",
        },
      };
      const response = await this.httpService.post(rpc, payload);
      if (response?.result?.result) {
        const byteArray = new Uint8Array(response.result.result);
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(byteArray);

        const intentDetails = JSON.parse(jsonString);
        return intentDetails;
      } else {
        console.error("Unexpected response format:", response);
        return null;
      }
    } catch (error) {
      console.error("Failed to get intent:", error);
      return null;
    }
  }

  async initialize(intentID: string): Promise<Intent | null> {
    const intentDetails = await this.getIntent(intentID);
    if (!intentDetails) {
      return null;
    }
    const intent = {
      intentID,
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
    };
    return intent;
  }
}

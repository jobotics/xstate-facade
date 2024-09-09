import { HttpService } from "./http.service";
import { Buffer } from "buffer";
import {
  HttpResponse,
  IntentDetails,
  NearHttpResponse,
} from "../interfaces/swap-machine.in.interfaces";
import {
  QuoteParams,
  SolverQuote,
} from "src/interfaces/swap-machine.ex.interfaces";

const rpc = "https://nearrpc.aurora.dev";
const protocolId = "swap-defuse.near";

export class ApiService {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  async getIntent(intentId: string): Promise<IntentDetails | null> {
    try {
      const payload = {
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: protocolId,
          method_name: "get_intent",
          args_base64: Buffer.from(JSON.stringify({ id: intentId })).toString(
            "base64",
          ),
        },
      };
      const response = await this.httpService.post<
        NearHttpResponse<Uint8Array>
      >(rpc, payload);
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

  async getQuotes(params: QuoteParams): Promise<SolverQuote[]> {
    try {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "query",
        params: [
          {
            defuse_asset_identifier_in: params.defuseAssetIdEntifierIn,
            defuse_asset_identifier_out: params.defuseAssetIdEntifierOut,
            amount_in: params.amountIn,
            intent_type: params.intentType,
          },
        ],
      };
      const response = await this.httpService.post<
        NearHttpResponse<SolverQuote[]>
      >(rpc, payload);
      if (response?.result?.result?.length > 0) {
        return response.result.result;
      } else {
        console.error("Unexpected response format:", response);
        return [];
      }
    } catch (error) {
      console.error("Failed to get quotes:", error);
      return [];
    }
  }
}

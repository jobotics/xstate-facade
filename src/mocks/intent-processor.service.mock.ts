import { QuoteParams } from "src/interfaces/swap-machine.ex.interface";
import { SolverQuote } from "src/interfaces/swap-machine.in.interface";

export class IntentProcessorServiceMock {
  count = 0;

  increment = () => {
    this.count++;
    return this.count;
  };

  async fetchQuotes(input: Partial<QuoteParams>): Promise<SolverQuote[]> {
    return [
      {
        query_id: this.increment(),
        tokens: {
          "nep141:ft1.near": "-1000" + this.count,
          "nep141:ft2.near": "2000" + this.count,
        },
      },
      {
        query_id: this.increment(),
        tokens: {
          "nep141:ft1.near": "-100" + this.count,
          "nep141:ft2.near": "200" + this.count,
        },
      },
    ];
  }

  async prepareSignMessage(input: any): Promise<any> {
    return {
      message: "Login with NEAR",
      recipient: "swap-defuse.near",
      nonce: Buffer.from("mockedNonce"),
    };
  }
}

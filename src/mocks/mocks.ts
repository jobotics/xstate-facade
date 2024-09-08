import {
  IntentState,
  SwapProgressEnum,
} from "src/interfaces/swap-machine.ex.interfaces";
import { Intent } from "src/interfaces/swap-machine.in.interfaces";

export const mockInput = {
  assetIn: {
    defuseAssetId:
      "aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
    decimals: 18,
    assetName: "AURORA",
    metadataLink:
      "https://assets.coingecko.com/coins/images/20582/standard/aurora.jpeg",
    routes: [
      "near:mainnet:native",
      "near:mainnet:wrap.near",
      "near:mainnet:usdt.tether-token.near",
    ],
  },
  assetOut: {
    defuseAssetId: "eth:8453:0x2Fa2EdA29225ab5DE488597e2201838eC5D28261",
    decimals: 18,
    assetName: "GAGAIN",
    metadataLink: "",
    routes: [],
  },
  amountIn: "100000000000000000",
  amountOut: "252086045407911457701",
  intentId: "be5b7968012e14be48e03db3af4ebea062ef6c91a88b81566c61670bb8d6bf14",
  accountId: "75d44b5a0f717b05cfa0a5869f5245a28bf21f1e9d13778c2e7e176b5ffb1a8d",
};

export const mockIntent = {
  hash: "GAHrgNnnyZ6kqY1uSziYRGsXuspc8NnDA1rTFZbw11Wi",
  state: "Confirmed",
  ...mockInput,
};

export const mockQuote = {
  defuseAssetIdentifierIn: "near:mainnet:usdt.tether-token.near",
  defuseAssetIdentifierOut:
    "near:mainnet:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  amountIn: "10000000",
  intentType: "dip2",
};

export const mockIntentId =
  "5f0c2ea48a05f2409f8037c014440ee45d0a700407b7682b683abbd737909d24";

export const mockGetIntent: Intent = {
  intentId: "5f0c2ea48a05f2409f8037c014440ee45d0a700407b7682b683abbd737909d24",
  initiator: "75d44b5a0f717b05cfa0a5869f5245a28bf21f1e9d13778c2e7e176b5ffb1a8d",
  assetIn:
    "near:mainnet:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  assetOut: "eth:8453:0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  amountIn: "2000000",
  amountOut: "1970026",
  expiration: 126319840,
  lockup: 126319840,
};

export const mockIntentState: IntentState = {
  status: SwapProgressEnum.Confirmed,
  proof: "0x3fc1b193ad081ff8634fa1905dab46ba7492c0c45fc69a9cfe7840ec8a03cb7a",
  ...mockGetIntent,
};

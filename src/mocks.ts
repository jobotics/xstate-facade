export const mockInput = {
    assetIn: {
        defuseAssetID: "aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
        decimals: 18,
        assetName: "AURORA",
        metadataLink: "https://assets.coingecko.com/coins/images/20582/standard/aurora.jpeg",
        routes: ["near:mainnet:native", "near:mainnet:wrap.near", "near:mainnet:usdt.tether-token.near"]
    },
    assetOut: {
        defuseAssetID: "eth:8453:0x2Fa2EdA29225ab5DE488597e2201838eC5D28261",
        decimals: 18,
        assetName: "GAGAIN",
        metadataLink: "",
        routes: []
    },
    amountIn: "100000000000000000",
    amountOut: "252086045407911457701",
    intentID: "be5b7968012e14be48e03db3af4ebea062ef6c91a88b81566c61670bb8d6bf14",
    accountID: "75d44b5a0f717b05cfa0a5869f5245a28bf21f1e9d13778c2e7e176b5ffb1a8d",
}

export const mockIntents = [
    {
        hash: "GAHrgNnnyZ6kqY1uSziYRGsXuspc8NnDA1rTFZbw11Wi",
        state: "Confirmed",
        ...mockInput
    }
]

export const mockQuote = {
    defuseAssetIdentifierIn: "near:mainnet:usdt.tether-token.near",
    defuseAssetIdentifierOut: "near:mainnet:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    amountIn: "10000000",
    intentType: "dip2",
}

import {Intent} from "./swap-machine.in.interfaces";

/**
 * External interfaces for communication with xstate-facade.
 * It is assumed that all other swap-machines will have adapters from internal to external interfaces.
 *
 * Additional Notes:
 * - Input - abstract swap data model for UI adaptation.
 * - Asset - abstract element of asset list for UI adaptation.
 * - AssetList - abstract list of assets aim for UI adaptation.
 * - IntentState - abstract state swap changes for UI adaptation.
 * - SwapProgressEnum - abstract statuses enum for UI adaptation.
 * - Context - abstract getter of intent state for UI adaptation.
 * - Quote - abstract quoting data model for UI adaptation.
 * - QuoteList - abstract quoted list for UI adaptation.
 */

export enum SwapProgressEnum {
    Idle = "Idle",
    Quoting = "Quoting",
    Quoted = "Quoted",
    Submitting = "Submitting",
    Submitted = "Submitted",
    Confirming = "Confirming",
    Confirmed = "Confirmed",
    Failed = "Failed",
};

export type Input = {
    assetIn: Asset;
    assetOut: Asset;
    amountIn: string;
    amountOut: string;
    intentID: string;
    accountID: string;
    // Next entities aim for cross-swap
    solverID?: string;
    accountFrom?: string;
    accountTo?: string;
    // Next entities aim for time execution
    expiration?: number;
    lockup?: boolean;
};

export type Asset = {
    defuseAssetID: string
    decimals: number
    assetName: string
    metadataLink: string
    routes: string[]
}

export type IntentState = Intent & {
    hash: string;
    status: SwapProgressEnum;
};

export type Context = {
    intents: Record<string, IntentState>;
    current: string;
};

export interface Quote {
    defuseAssetIdentifierIn: string;
    defuseAssetIdentifierOut: string;
    amountIn: string;
    intentType: string;
}

export type AssetList = Asset[]

export type QuoteList = {
    solverID: string
    amountOut: string
}[]

/**
 * Internal interfaces, for describing types inside swap-machines and not exposed out.
 */

import { IntentState } from "./swap-machine.ex.interfaces";

export enum SwapStatusEnum {
    Available = "available",
    Completed = "Completed",
    Executed = "executed",
    RolledBack = "rolled_back",
}

export interface Intent {
    intentID: string;
    initiator: string;
    assetIn: string;
    assetOut: string;
    amountIn: string;
    amountOut: string;
    expiration?: number;
    lockup?: boolean;
}

export type Events =
    | { type: "FETCH_QUOTE"; intentID: string }
    | { type: "FETCH_QUOTE_SUCCESS"; intentID: string }
    | { type: "FETCH_QUOTE_ERROR"; intentID: string }
    | { type: "SUBMIT_SWAP"; intentID: string }
    | { type: "SUBMIT_SWAP_SUCCESS"; intentID: string }
    | { type: "SUBMIT_SWAP_ERROR"; intentID: string }
    | { type: "CONFIRM_SWAP"; intentID: string }
    | { type: "CONFIRM_SWAP_SUCCESS"; intentID: string }
    | { type: "CONFIRM_SWAP_ERROR"; intentID: string }
    | { type: "QUOTE_EXPIRED"; intentID: string }
    | { type: "RETRY_INTENT"; intentID: string }
    | { type: "SET_INTENT"; intent: Partial<IntentState> };

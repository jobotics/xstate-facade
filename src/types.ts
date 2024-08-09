// types.ts

// Define the possible states of the state machine
export enum SwapState {
  Idle = "Idle",
  FetchingQuotes = "FetchingQuotes",
  QuoteReceived = "QuoteReceived",
  InitiatingSwap = "InitiatingSwap",
  WaitingForExecution = "WaitingForExecution",
  SwapExecuted = "SwapExecuted",
  Error = "Error",
  Completed = "Completed",
  Retrying = "Retrying",
}

// Define the structure of a Quote
export interface Quote {
  solverID: string;
  intentID: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  expiration?: number; // Optional, in milliseconds
}

// Define the structure of an Intent
export interface Intent {
  intentID: string;
  initiator: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  expiration?: number; // Optional, default is 1 day in milliseconds
  lost?: boolean; // Optional, if intent expired or was rollbacked
}

// Define the structure of a Swap
export interface Swap {
  intentID: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  quote?: Quote; // Optional, quote received for the swap
  state: SwapState; // Current state of the swap
}

// Define the context of the state machine
export interface SwapContext {
  swaps: Swap[]; // Array of swaps being managed
}

// Define the possible events that can occur in the state machine
export type SwapEvent =
  | { type: "FETCH_QUOTES"; intent: Intent }
  | { type: "QUOTES_FETCHED"; intentID: string; quote: Quote }
  | { type: "INITIATE_SWAP"; intentID: string }
  | { type: "SWAP_INITIATED"; intentID: string }
  | { type: "EXECUTION_CONFIRMED"; intentID: string }
  | { type: "INTENT_LOST"; intentID: string }
  | { type: "ERROR_OCCURRED"; intentID: string; error: string }
  | { type: "RETRY_INTENT"; intentID: string }
  | { type: "INTENT_COMPLETED"; intentID: string }
  | { type: "QUOTE_EXPIRED"; intentID: string }
  | {
      type: "CONTEXT_CHANGED";
      assetIn?: string;
      assetOut?: string;
      amountIn?: string;
    };

// Define actions that can be taken in the state machine
export type SwapAction =
  | { type: "fetchQuotes"; intent: Intent }
  | { type: "handleQuotesFetched"; intentID: string; quote: Quote }
  | { type: "initiateSwap"; intentID: string }
  | { type: "handleSwapInitiated"; intentID: string }
  | { type: "waitForExecution"; intentID: string }
  | { type: "confirmExecution"; intentID: string }
  | { type: "retryIntent"; intentID: string }
  | { type: "handleError"; intentID: string; error: string }
  | { type: "completeIntent"; intentID: string };

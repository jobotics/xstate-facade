import { assign, setup, fromPromise } from "xstate";
import { Intent, Quote, SwapContext, SwapEvent, SwapState } from "./types";

// Helper function to find a swap by intentID
const findSwapByIntentID = (swaps: SwapContext["swaps"], intentID: string) =>
  swaps.find((swap) => swap.intentID === intentID);

export const swapMachine = setup({
  types: {
    context: {} as SwapContext,
    events: {} as SwapEvent,
  },
  actors: {
    fetchQuotes: fromPromise(({ input }: { input: Intent }) =>
      fetchQuotes(input),
    ),
    initiateSwap: fromPromise(({ input }: { input: Quote }) =>
      initiateSwap(input),
    ),
    waitForExecution: fromPromise(
      ({ input }: { input: { intentID: string } }) =>
        waitForExecution(input.intentID),
    ),
    retrySwap: fromPromise(({ input }: { input: { intentID: string } }) =>
      retrySwap(input.intentID),
    ),
  },
}).createMachine({
  id: "swapMachine",
  initial: SwapState.Idle,
  context: {
    swaps: [
      {
        intentID: "",
        assetIn: "USDT",
        assetOut: "NEAR",
        amountIn: "1",
        state: SwapState.Idle,
      },
    ],
  },
  states: {
    [SwapState.Idle]: {
      on: {
        FETCH_QUOTES: {
          target: SwapState.FetchingQuotes,
          actions: assign(({ context, event }) => {
            if (event.type === "FETCH_QUOTES") {
              return {
                swaps: [
                  ...context.swaps,
                  {
                    intentID: event.intent.intentID,
                    assetIn: event.intent.assetIn,
                    assetOut: event.intent.assetOut,
                    amountIn: event.intent.amountIn,
                    state: SwapState.FetchingQuotes,
                  },
                ],
              };
            }
            return context;
          }),
        },
      },
    },
    [SwapState.FetchingQuotes]: {
      invoke: {
        src: "fetchQuotes",
        input: ({ context }) => {
          const swap = context.swaps[context.swaps.length - 1];
          return { ...swap, initiator: "" }; // TODO: provide initiator address from context
        },
        onDone: {
          target: SwapState.QuoteReceived,
          actions: assign(({ context, event }) => {
            const { intentID } = event.output;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.quote = event.output;
              swap.state = SwapState.QuoteReceived;
            }
            return context;
          }),
        },
        onError: {
          target: SwapState.Error,
          actions: assign(({ context, event }) => {
            const { intentID } = event.error;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.Error;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.QuoteReceived]: {
      on: {
        INITIATE_SWAP: {
          target: SwapState.InitiatingSwap,
          actions: assign(({ context, event }) => {
            const swap = findSwapByIntentID(context.swaps, event.intentID);
            if (swap) {
              swap.state = SwapState.InitiatingSwap;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.InitiatingSwap]: {
      invoke: {
        src: "initiateSwap",
        input: ({ context }) => {
          const swap = context.swaps[context.swaps.length - 1];
          return swap.quote || ({} as Quote); // TODO: rectify Quote type requirement
        },
        onDone: {
          target: SwapState.WaitingForExecution,
          actions: assign(({ context, event }) => {
            const { intentID } = event.output;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.WaitingForExecution;
            }
            return context;
          }),
        },
        onError: {
          target: SwapState.Error,
          actions: assign(({ context, event }) => {
            const { intentID } = event.error;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.Error;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.WaitingForExecution]: {
      invoke: {
        src: "waitForExecution",
        input: ({ context }) => {
          const swap = context.swaps[context.swaps.length - 1];
          return { intentID: swap.intentID };
        },
        onDone: {
          target: SwapState.SwapExecuted,
          actions: assign(({ context, event }) => {
            const { intentID } = event.output;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.SwapExecuted;
            }
            return context;
          }),
        },
        onError: {
          target: SwapState.Error,
          actions: assign(({ context, event }) => {
            const { intentID } = event.error;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.Error;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.SwapExecuted]: {
      on: {
        INTENT_COMPLETED: {
          target: SwapState.Completed,
          actions: assign(({ context, event }) => {
            const swap = findSwapByIntentID(context.swaps, event.intentID);
            if (swap) {
              swap.state = SwapState.Completed;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.Error]: {
      on: {
        RETRY_INTENT: {
          target: SwapState.Retrying,
          actions: assign(({ context, event }) => {
            const swap = findSwapByIntentID(context.swaps, event.intentID);
            if (swap) {
              swap.state = SwapState.Retrying;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.Retrying]: {
      invoke: {
        src: "retrySwap",
        input: ({ context }) => {
          const swap = context.swaps[context.swaps.length - 1];
          return { intentID: swap.intentID };
        },
        onDone: {
          target: SwapState.FetchingQuotes,
          actions: assign(({ context, event }) => {
            const { intentID } = event.output;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.FetchingQuotes;
            }
            return context;
          }),
        },
        onError: {
          target: SwapState.Error,
          actions: assign(({ context, event }) => {
            const { intentID } = event.error;
            const swap = findSwapByIntentID(context.swaps, intentID);
            if (swap) {
              swap.state = SwapState.Error;
            }
            return context;
          }),
        },
      },
    },
    [SwapState.Completed]: {
      type: "final",
    },
  },
});

function retrySwap(
  intentID: string,
): Promise<{ intentID: string; result: boolean }> {
  return new Promise((resolve) => {
    // Simulate waiting for execution
    setTimeout(() => {
      resolve({ intentID, result: true });
    }, 1000);
  });
}

function waitForExecution(
  intentID: string,
): Promise<{ intentID: string; result: boolean }> {
  return new Promise((resolve) => {
    // Simulate waiting for execution
    setTimeout(() => {
      resolve({ intentID, result: true });
    }, 1000);
  });
}

function initiateSwap(
  quote: Quote,
): Promise<{ intentID: string; result: boolean }> {
  return new Promise((resolve) => {
    // Simulate initiating swap
    setTimeout(() => {
      resolve({ intentID: quote.intentID, result: true });
    }, 500);
  });
}

function fetchQuotes(intent: Intent): Promise<Quote> {
  return new Promise((resolve, reject) => {
    // Simulate fetching quotes
    setTimeout(() => {
      resolve({
        solverID: "1",
        assetIn: intent.assetIn,
        assetOut: intent.assetOut,
        amountIn: intent.amountIn,
        amountOut: intent.amountIn, // TODO: change the computed amountOut
        expiration: Date.now() + 10000,
      } as Quote);
    }, 500);

    setTimeout(() => {
      reject({ intentID: intent.intentID });
    });
  });
}

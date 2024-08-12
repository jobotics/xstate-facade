import { assign, setup, fromPromise } from "xstate";

// Enum to represent the progress of the swap
export enum SwapProgress {
  Idle = "Idle",
  FetchingQuote = "FetchingQuote",
  Quoted = "Quoted",
  Submitting = "Submitting",
  Submitted = "Submitted",
  Confirming = "Confirming",
  Confirmed = "Confirmed",
  Failed = "Failed",
}

// Data models
export interface Quote {
  solverID: string;
  intentID: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  expiration?: number;
}

export interface Intent {
  intentID: string;
  initiator: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  expiration?: number;
  lost?: boolean;
}

export type IntentState = Intent & {
  quote?: Quote;
  state: SwapProgress;
};

export interface Input {
  assetIn?: string;
  assetOut?: string;
  amountIn?: string;
}

export interface Context {
  intents: Record<string, IntentState>;
  current: string;
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

export const swapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
  },
  actions: {
    updateIntent: assign({
      intents: ({ context }, params: { intent: Partial<IntentState> }) => ({
        ...context.intents,
        [params.intent.intentID! || context.current]: {
          ...context.intents[params.intent.intentID! || context.current],
          ...params.intent,
        },
      }),
    }),
    selectIntent: assign({
      current: (_, params: { intentID: string }) => params.intentID,
    }),
  },
  actors: {
    fetchQuotes: fromPromise(({ input }: { input: { intent: Intent } }) =>
      fetchQuotes(input.intent),
    ),
    submitSwap: fromPromise(({ input }: { input: { intent: Intent } }) =>
      initiateSwap(input.intent),
    ),
    confirmSwap: fromPromise(({ input }: { input: { intentID: string } }) =>
      waitForExecution(input.intentID),
    ),
  },
  guards: {
    hasValidQuote: ({ context }) =>
      context.intents[context.current].state === SwapProgress.Quoted,
  },
}).createMachine({
  id: "swapMachine",
  initial: "Idle",
  context: ({ input }: { input: Input }) => ({
    intents: {
      "0": {
        intentID: "0",
        assetIn: input?.assetIn ?? "USDT",
        assetOut: input?.assetOut ?? "NEAR",
        amountIn: input?.amountIn ?? "1",
        initiator: "sender.near",
        state: SwapProgress.Idle,
      },
    },
    current: "0",
  }),
  states: {
    Idle: {
      type: "parallel",
      states: {
        quote: {
          initial: "polling",
          on: {
            FETCH_QUOTE: "quote",
          },
          states: {
            polling: {
              entry: [
                {
                  type: "updateIntent",
                  params: {
                    intent: {
                      state: SwapProgress.FetchingQuote,
                    },
                  },
                },
              ],
              invoke: {
                src: "fetchQuotes",
                input: ({ context }) => ({
                  intent: context.intents[context.current],
                }),
                onDone: {
                  target: "quoted",
                  actions: [
                    {
                      type: "updateIntent",
                      params: ({ event }) => ({
                        intent: {
                          quote: event.output,
                          state: SwapProgress.Quoted,
                        },
                      }),
                    },
                  ],
                },
                onError: {
                  target: "none",
                  actions: {
                    type: "updateIntent",
                    params: {
                      intent: { state: SwapProgress.Failed },
                    },
                  },
                },
              },
            },
            quoted: {
              after: {
                5000: "polling", // Automatically refresh quotes every 5 seconds
              },
            },
            none: {
              after: {
                500: "polling",
              },
            },
          },
        },
        input: {
          initial: "listening",
          states: {
            listening: {
              on: {
                SUBMIT_SWAP: {
                  target: "#swapMachine.Submitting",
                  guard: "hasValidQuote",
                },
                SET_INTENT: {
                  actions: [
                    {
                      type: "selectIntent",
                      params: ({ event }) => ({
                        intentID: event.intent.intentID!,
                      }),
                    },
                    {
                      type: "updateIntent",
                      params: ({ event }) => ({ intent: event.intent }),
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    Submitting: {
      entry: {
        type: "updateIntent",
        params: {
          intent: { state: SwapProgress.Submitting },
        },
      },
      invoke: {
        src: "submitSwap",
        input: ({ context }) => ({
          intent: context.intents[context.current],
        }),
        onDone: {
          target: "Confirming",
          actions: {
            type: "updateIntent",
            params: {
              intent: { state: SwapProgress.Submitted },
            },
          },
        },
        onError: {
          target: "Failed",
          actions: {
            type: "updateIntent",
            params: {
              intent: { state: SwapProgress.Failed },
            },
          },
        },
      },
    },
    Confirming: {
      entry: {
        type: "updateIntent",
        params: {
          intent: { state: SwapProgress.Confirming },
        },
      },
      invoke: {
        src: "confirmSwap",
        input: ({ context }) => ({
          intentID: context.current,
        }),
        onDone: {
          target: "Confirmed",
          actions: {
            type: "updateIntent",
            params: {
              intent: { state: SwapProgress.Confirmed },
            },
          },
        },
        onError: {
          target: "Failed",
          actions: {
            type: "updateIntent",
            params: {
              intent: { state: SwapProgress.Failed },
            },
          },
        },
      },
    },
    Confirmed: {
      type: "final",
    },
    Failed: {
      on: {
        RETRY_INTENT: "Submitting", // Retry directly transitions to submitting
      },
    },
  },
  actions: {
    stopQuoting: assign({
      intents: ({ context }) => {
        const currentIntent = context.intents[context.current];
        if (currentIntent.state === SwapProgress.Quoted) {
          currentIntent.state = SwapProgress.Submitting;
        }
        return context.intents;
      },
    }),
  },
});

type ActionResult = { intentID: string; result: boolean };

async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}

async function fetchQuotes(intent: Intent): Promise<Quote> {
  await sleep(200);
  return Promise.resolve({
    solverID: "1",
    intentID: intent.intentID,
    assetIn: intent.assetIn,
    assetOut: intent.assetOut,
    amountIn: intent.amountIn,
    amountOut: intent.amountIn,
    expiration: Date.now() + 10000,
  });
}

async function initiateSwap({ intentID }: Intent): Promise<ActionResult> {
  await sleep(200);
  return Promise.resolve({ intentID, result: true });
}

async function waitForExecution(intentID: string): Promise<ActionResult> {
  await sleep(1000);
  return Promise.resolve({ intentID, result: true });
}

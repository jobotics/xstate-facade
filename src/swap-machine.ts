import { assign, setup, fromPromise } from "xstate";

// Enum to represent the progress of the swap
export enum SwapProgress {
  Idle = "Idle",
  Quoting = "Quoting",
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

export type Input = {
  assetIn?: string;
  assetOut?: string;
  amountIn?: string;
};

export type Context = {
  intents: Record<string, IntentState>;
  current: string;
};

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

const next = (state: SwapProgress) => {
  switch (state) {
    case SwapProgress.Idle:
      return SwapProgress.Quoting;
    case SwapProgress.Quoting:
      return SwapProgress.Quoted;
    case SwapProgress.Quoted:
      return SwapProgress.Submitting;
    case SwapProgress.Submitting:
      return SwapProgress.Submitted;
    case SwapProgress.Submitted:
      return SwapProgress.Confirming;
    case SwapProgress.Confirming:
      return SwapProgress.Confirmed;
    case SwapProgress.Failed:
      return SwapProgress.Submitting;
    default:
      return SwapProgress.Idle;
  }
};

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
    progressIntent: assign({
      intents: ({ context }) => ({
        ...context.intents,
        [context.current]: {
          ...context.intents[context.current],
          state: next(context.intents[context.current].state),
        },
      }),
    }),
    failIntent: assign({
      intents: ({ context }) => ({
        ...context.intents,
        [context.current]: {
          ...context.intents[context.current],
          state: SwapProgress.Failed,
        },
      }),
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
          states: {
            polling: {
              entry: [
                {
                  type: "updateIntent",
                  params: {
                    intent: {
                      state: SwapProgress.Quoting,
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
                    "progressIntent",
                    {
                      type: "updateIntent",
                      params: ({ event }) => ({
                        intent: {
                          assetOut: event.output.assetOut,
                          quote: event.output,
                        },
                      }),
                    },
                  ],
                },
                onError: {
                  target: "none",
                  actions: ["failIntent"],
                },
              },
            },
            quoted: {
              after: {
                5000: "polling",
              },
            },
            none: {
              after: {
                500: "polling",
              },
            },
          },
          on: {
            FETCH_QUOTE: "quote",
          },
        },
        input: {
          on: {
            SUBMIT_SWAP: {
              target: "#swapMachine.Submitting",
              guard: "hasValidQuote",
            },
            SET_INTENT: {
              target: "#swapMachine.Idle.quote",
              actions: [
                {
                  type: "selectIntent",
                  params: ({ event }) => ({
                    intentID: event.intent.intentID!,
                  }),
                },
                {
                  type: "updateIntent",
                  params: ({ event }) => ({
                    intent: { ...event.intent, state: SwapProgress.Idle },
                  }),
                },
              ],
            },
          },
        },
      },
    },
    Submitting: {
      entry: ["progressIntent"],
      invoke: {
        src: "submitSwap",
        input: ({ context }) => ({
          intent: context.intents[context.current],
        }),
        onDone: {
          target: "Confirming",
          actions: ["progressIntent"],
        },
        onError: {
          target: "Failed",
          actions: ["failIntent"],
        },
      },
    },
    Confirming: {
      entry: ["progressIntent"],
      invoke: {
        src: "confirmSwap",
        input: ({ context }) => ({
          intentID: context.current,
        }),
        onDone: {
          target: "Confirmed",
          actions: ["progressIntent"], // TODO: set tx hash
        },
        onError: {
          target: "Failed",
          actions: ["failIntent"],
        },
      },
    },
    Confirmed: {
      type: "final",
    },
    Failed: {
      on: {
        RETRY_INTENT: "Submitting",
      },
    },
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

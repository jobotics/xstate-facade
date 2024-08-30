import { assign, setup, fromPromise } from "xstate";
import {Context, Input, IntentState, Quote, SwapProgressEnum} from "./swap-machine.ex.interfaces";
import {Events, Intent} from "./swap-machine.in.interfaces";

const next = (state: SwapProgressEnum) => {
  switch (state) {
    case SwapProgressEnum.Idle:
      return SwapProgressEnum.Quoting;
    case SwapProgressEnum.Quoting:
      return SwapProgressEnum.Quoted;
    case SwapProgressEnum.Quoted:
      return SwapProgressEnum.Submitting;
    case SwapProgressEnum.Submitting:
      return SwapProgressEnum.Submitted;
    case SwapProgressEnum.Submitted:
      return SwapProgressEnum.Confirming;
    case SwapProgressEnum.Confirming:
      return SwapProgressEnum.Confirmed;
    case SwapProgressEnum.Failed:
      return SwapProgressEnum.Submitting;
    default:
      return SwapProgressEnum.Idle;
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
          state: SwapProgressEnum.Failed,
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
      context.intents[context.current].state === SwapProgressEnum.Quoted,
  },
}).createMachine({
  id: "swapMachine",
  initial: "Idle",
  context: ({ input }: { input: IntentState[] }) => {
    const intents = input?.reduce((acc, props, index) => {
      acc[`${index}`] = { ...props };
      return acc;
    }, {});

    return {
      intents: intents || {},
      current: input?.length.toString() ?? "0",
    };
  },
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
                      state: SwapProgressEnum.Quoting,
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
                    intent: { ...event.intent, state: SwapProgressEnum.Idle },
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

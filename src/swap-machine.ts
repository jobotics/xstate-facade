import { assign, setup, fromPromise, sendTo } from "xstate";
import {
  Context,
  Events,
  Input,
  Quote,
  QuoteParams,
} from "./interfaces/swap-machine.ex.interfaces";
import { IntentProcessorService } from "./services/intent-processor.service";
import { sleep } from "./utils/utils";
import { ApiService } from "./services/api.service";
import {
  Intent,
  SwapProgressEnum,
} from "./interfaces/swap-machine.in.interfaces";

const intentProcessorService = new IntentProcessorService(new ApiService());

export const swapMachine = setup({
  types: {} as {
    context: Context;
    events: Events;
    input: Input | { intentId: string };
    output: {
      quotes: Quote[];
    };
  },
  actions: {
    fetchingQuotes: assign({
      quotes: ({ event }) => {
        if ("data" in event && "quotes" in event.data) {
          return event.data.quotes;
        }
        return [];
      },
      state: SwapProgressEnum.Quoted,
    }),
    updateIntent: assign({
      intent: (_, params: { intent: Partial<Intent> }) => ({
        ..._.intent,
        ...params.intent,
      }),
    }),
    progressIntent: assign({
      intent: (context, event) => ({
        ...context.intent,
        state: SwapProgressEnum.Confirming,
      }),
    }),
    failIntent: assign({
      intent: (context) => ({
        ...context.intent,
        state: SwapProgressEnum.Failed,
      }),
    }),
    recoveringIntent: assign({
      intent: (context, event) => {
        if (context.event?.output) {
          return context.event.output.intent;
        }
        return context.intent; // Fallback to current intent if no output
      },
      state: (context) => {
        return context.event?.output?.state || context.state;
      },
    }),
    log: (context, event) => {
      console.log("Current context:", JSON.stringify(context));
      console.log("Current event:", JSON.stringify(event));
    },
    updateCallData: assign({
      intent: (context, event) => ({
        ...context.intent,
        callData: event?.output?.callData || null, // Use optional chaining and provide a fallback
      }),
    }),
  },
  actors: {
    fetchQuotes: fromPromise(({ input }: { input: QuoteParams }) =>
      intentProcessorService
        .fetchQuotes(input)
        .then((data) => ({ quotes: data })),
    ),
    submitingSwap: fromPromise(({ input }: { input: { intent: Input } }) =>
      intentProcessorService
        .prepareSwapCallData(input.intent)
        .then((callData) => ({
          callData,
        })),
    ),
    confirmSwap: fromPromise(({ input }: { input: Pick<Intent, "intentId"> }) =>
      waitForExecution(input.intentId),
    ),
    recoverIntent: fromPromise(
      ({ input }: { input: Pick<Intent, "intentId"> }) =>
        intentProcessorService.initialize(input.intentId).then((data) => data),
    ),
  },
  guards: {
    hasValidQuote: ({ context }) =>
      context.intent.state === SwapProgressEnum.Quoted,
    hasValidIntent: ({ context }) => !!context.intent.intentId,
    hasEnoughInfoForQuote: ({ context }) => {
      const intent = context.intent;
      return !!(
        intent?.assetIn &&
        intent?.assetOut &&
        intent?.amountIn &&
        !intent?.status
      );
    },
    hasValidQuoteParams: ({ event }) => {
      const intent = event.intent;
      return !!(intent?.assetIn && intent?.assetOut && intent?.amountIn);
    },
    hasValidSubmitSwapParams: ({ event }) => {
      const intent = event.intent;
      return !!(
        intent?.assetIn &&
        intent?.assetOut &&
        intent?.amountIn &&
        intent?.amountOut &&
        intent?.accountId
      );
    },
  },
}).createMachine({
  id: "swapMachine",
  initial: "Idle",
  context: ({ input }) => ({
    intent: input || {},
    state: SwapProgressEnum.Idle,
    quotes: [],
  }),
  states: {
    Idle: {
      type: "parallel",
      states: {
        recover: {
          initial: "checking",
          states: {
            checking: {
              always: [
                {
                  target: "recovering",
                  guard: "hasValidIntent",
                },
                { target: "done" },
              ],
            },
            recovering: {
              invoke: {
                src: "recoverIntent",
                input: ({ context }) => ({
                  intentId: context.intent.intentId,
                }),
                onDone: {
                  target: "done",
                  actions: ["recoveringIntent", "log"],
                },
                onError: {
                  target: "done",
                  actions: "failIntent",
                },
              },
            },
            done: {
              type: "final",
            },
          },
        },
        quote: {
          initial: "polling",
          states: {
            polling: {
              always: [
                {
                  guard: "hasEnoughInfoForQuote",
                  target: "fetching",
                },
              ],
            },
            fetching: {
              invoke: {
                src: "fetchQuotes",
                input: ({ context }): QuoteParams => ({
                  ...context.intent,
                }),
                onDone: {
                  target: "quoted",
                  actions: "fetchingQuotes",
                },
                onError: {
                  target: "none",
                  actions: "failIntent",
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
            SET_INTENT: {
              target: "#swapMachine.Idle.quote",
              guard: "hasValidQuoteParams",
              actions: [
                {
                  type: "updateIntent",
                  params: ({ event }) => ({
                    intent: { ...event.intent },
                  }),
                },
              ],
            },
            SUBMIT_SWAP: {
              target: "#swapMachine.Submitting",
              guard: "hasValidSubmitSwapParams",
              actions: [
                {
                  type: "updateIntent",
                  params: ({ event }) => ({
                    intent: { ...event.intent },
                  }),
                },
              ],
            },
          },
        },
      },
    },
    Submitting: {
      invoke: {
        src: "submitingSwap",
        input: ({ context }) => ({
          intent: context.intent,
        }),
        onDone: {
          target: "WaitingForSignature",
          actions: [
            "updateCallData", // Use the new action
            sendTo(
              ({ self }) => self,
              (context, event) => ({
                type: "SUBMIT_SWAP_SUCCESS",
                data: { callData: event?.output?.callData || null },
              }),
            ),
          ],
        },
        onError: {
          target: "Failed",
          actions: ["failIntent"],
        },
      },
    },
    WaitingForSignature: {
      on: {
        SIGN_AND_SUBMIT: {
          target: "Confirming",
          actions: assign({
            intent: (context, event) => ({
              ...context.intent,
              transactionHash: event.transactionHash,
            }),
          }),
        },
      },
    },
    Confirming: {
      entry: ["progressIntent", "log"],
      invoke: {
        src: "confirmSwap",
        input: ({ context }) => ({
          intentId: context.current,
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

type ActionResult = { intentId: string; result: boolean };

async function waitForExecution(intentId: string): Promise<ActionResult> {
  await sleep(1000);
  return Promise.resolve({ intentId, result: true });
}

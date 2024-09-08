import { assign, setup, fromPromise } from "xstate";
import {
  Context,
  IntentState,
  SwapProgressEnum,
} from "./interfaces/swap-machine.ex.interfaces";
import { Events, Intent } from "./interfaces/swap-machine.in.interfaces";
import { IntentProcessorService } from "./services/intent-processor.service";
import { sleep } from "./utils/utils";
import { ApiService } from "./services/api.service";

const intentProcessorService = new IntentProcessorService(new ApiService());

export const swapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as { intentId?: string },
  },
  actions: {
    updateIntent: assign({
      intent: (_, params: { intent: Partial<IntentState> }) => ({
        ..._.intent,
        ...params.intent,
      }),
    }),
    selectIntent: assign({
      current: (_, params: { intentID: string }) => params.intentID,
    }),
    selectIntent: assign({
      current: (_, params: { intentID: string }) => params.intentID,
    }),
    progressIntent: assign({
      intent: (context) => ({
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
    recoverIntent: assign({
      intent: ({ context }) =>
        fromPromise(async () => {
          const recoveredIntent = await intentProcessorService.initialize(
            context.intent.intentId!,
          );
          return recoveredIntent || null;
        }),
    }),
  },
  actors: {
    fetchQuotes: fromPromise(({ input }: { input: QuoteParams }) =>
      intentProcessorService.fetchQuotes(input),
    ),
    submitSwap: fromPromise(({ input }: { input: { intent: Intent } }) =>
      initiateSwap(input.intent),
    ),
    confirmSwap: fromPromise(({ input }: { input: { intentId: string } }) =>
      waitForExecution(input.intentId),
    ),
    recoverIntent: fromPromise(({ input }) =>
      new IntentProcessorService().initialize(input.intentId),
    ),
  },
  guards: {
    hasValidQuote: ({ context }) =>
      context.intent.state === SwapProgressEnum.Quoted,
    hasValidIntent: ({ context }) =>
      !!context.intent.intentId && Object.keys(context.intent).length === 1,
    hasEnoughInfoForQuote: ({ context }) => {
      const intent = context.intent;
      return !!(
        intent.defuseAssetIdEntifierIn &&
        intent.defuseAssetIdEntifierOut &&
        intent.amountIn &&
        intent.intentType
      );
    },
  },
}).createMachine({
  id: "swapMachine",
  initial: "Idle",
  context: ({ input }) => ({
    intent: input?.intentId ? { intentId: input.intentId } : {},
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
                input: ({ context }) => ({ intentId: context.intent.intentId }),
                onDone: {
                  target: "done",
                  actions: [
                    assign({
                      intent: (_, event) => ({
                        ...event.output,
                        state: event.output.status, // Map 'status' to 'state'
                      }),
                    }),
                  ],
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
              entry: [
                {
                  type: "updateIntent",
                  guard: "hasEnoughInfoForQuote",
                  params: {
                    intent: {
                      state: SwapProgressEnum.Quoting,
                    },
                  },
                },
              ],
              invoke: {
                src: "fetchQuotes",
                input: ({ context }): QuoteParams => ({
                  defuseAssetIdEntifierIn: context.intent.assetIn,
                  defuseAssetIdEntifierOut: context.intent.assetOut,
                  amountIn: context.intent.amountIn,
                  intentType: context.intent.intentType || "dip2", // Default to "dip2" if not specified
                }),
                onDone: {
                  target: "quoted",
                  actions: [
                    "progressIntent",
                    {
                      type: "updateIntent",
                      params: ({ event }) => ({
                        intent: {
                          quotes: event.output,
                          state: SwapProgressEnum.Quoted,
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
                    intentId: event.intent.intentId!,
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
          intentId: context.current,
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

type ActionResult = { intentId: string; result: boolean };

async function initiateSwap({ intentId }: Intent): Promise<ActionResult> {
  await sleep(200);
  return Promise.resolve({ intentId, result: true });
}

async function waitForExecution(intentId: string): Promise<ActionResult> {
  await sleep(1000);
  return Promise.resolve({ intentId, result: true });
}

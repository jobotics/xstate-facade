import { assign, setup, fromPromise, emit, createActor } from "xstate";
import {
  Context,
  Events,
  Input,
  Quote,
  QuoteParams,
} from "./interfaces/swap-machine.ex.interfaces";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";
import {
  Intent,
  SwapProgressEnum,
} from "./interfaces/swap-machine.in.interfaces";
import { Events as EmitEvents } from "./interfaces/swap-machine.ex.interfaces";
import { createBrowserInspector } from "@statelyai/inspect";

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
    emitQuotingEvent: emit(({ context }) => ({
      type: "FETCH_QUOTE_SUCCESS",
      data: context.output,
    })),
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
    recoverIntent: fromPromise(
      ({ input }: { input: Pick<Intent, "intentId"> }) =>
        intentProcessorService.initialize(input.intentId).then((data) => data),
    ),
    fetchQuotes: fromPromise(({ input }: { input: QuoteParams }) =>
      intentProcessorService
        .fetchQuotes(input)
        .then((data) => ({ quotes: data })),
    ),
    submitSwap: fromPromise(({ input }: { input: { intent: Input } }) =>
      intentProcessorService
        .prepareSwapCallData(input.intent)
        .then((callData) => ({
          callData,
        })),
    ),
    fetchIntent: fromPromise(({ input }: { input: { intentId: string } }) =>
      intentProcessorService.fetchIntent(input.intentId).then((data) => data),
    ),
  },
  guards: {
    hasValidForRecovering: ({ context }) => !!context.intent.intentId,
    hasValidForQuoting: ({ context }) => {
      const intent = context.intent;
      return !!(intent?.assetIn && intent?.assetOut && intent?.amountIn);
    },
    hasValidForSubmitting: ({ event }) => {
      const intent = event.intent;
      return !!(
        intent?.assetIn &&
        intent?.assetOut &&
        intent?.amountIn &&
        intent?.amountOut &&
        intent?.accountId
      );
    },
    hasValidForSwapping: ({ event }) => {
      const hash = event.hash;
      return !!hash;
    },
  },
}).createMachine({
  id: "swapMachine",
  initial: "Loading",
  context: ({ input }) => ({
    intent: input || {},
    state: SwapProgressEnum.Loading,
    quotes: [],
  }),
  states: {
    Loading: {
      initial: "loading",
      states: {
        loading: {
          always: [
            {
              target: "recovering",
              guard: "hasValidForRecovering",
            },
            {
              target: "#swapMachine.Quoting",
              guard: "hasValidForQuoting",
            },
            { target: "waitingForInput" },
          ],
        },
        recovering: {
          invoke: {
            src: "recoverIntent",
            input: ({ context }) => ({
              intentId: context.intent.intentId,
            }),
            onDone: {
              target: "#swapMachine.Quoting",
              actions: ["progressIntent"],
            },
            onError: {
              target: "waitingForInput",
              actions: ["failIntent"],
            },
          },
        },
        waitingForInput: {
          on: {
            SET_INTENT: {
              target: "#swapMachine.Quoting",
              guard: "hasValidForQuoting",
            },
          },
        },
      },
    },
    Quoting: {
      initial: "quoting",
      states: {
        quoting: {
          invoke: {
            src: "fetchQuotes",
            input: ({ context }): QuoteParams => ({
              ...context.intent,
            }),
            onDone: {
              actions: [
                { type: "emitQuotingEvent" },
                { type: "progressIntent" },
              ],
              target: "quoted",
            },
          },
        },
        quoted: {
          after: {
            5000: "quoting",
          },
          on: {
            FETCH_QUOTE_SUCCESS: {
              target: "#swapMachine.Submitting",
              actions: ["progressIntent"],
              guard: "hasValidForSubmitting",
            },
          },
        },
      },
    },
    Submitting: {
      initial: "submitting",
      states: {
        submitting: {
          invoke: {
            src: "submitSwap",
            input: ({ context }) => ({
              intent: context.intent,
            }),
            actions: ["progressIntent"],
          },
        },
        waitingForSign: {
          on: {
            SUBMIT_SWAP_SUCCESS: {
              target: "#swapMachine.Swapping",
              guard: "hasValidForSwapping",
              actions: ["progressIntent"],
            },
          },
        },
      },
    },
    Swapping: {
      invoke: {
        src: "fetchIntent",
        input: ({ context }) => ({
          intent: context.intent,
        }),
        onDone: {
          target: "Confirmed",
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
        RETRY_INTENT: "Quoting",
      },
    },
  },
});

const isInspectEnabled = process.env.VITE_INSPECT === "true";
if (isInspectEnabled) {
  const { inspect } = createBrowserInspector();
  const actor = createActor(swapMachine, {
    inspect,
  });
  actor.start();
}

import { assign, setup, fromPromise, sendTo, createActor } from "xstate";
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
              guard: "hasValidIntent",
            },
            {
              target: "#swapMachine.Quoting",
              guard: "hasEnoughInfoForQuote",
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
              guard: "hasEnoughInfoForQuote",
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
              target: "quoted",
              actions: ["progressIntent"],
            },
            onError: {
              target: "#swapMachine.Failed",
              actions: ["failIntent"],
            },
          },
        },
        quoted: {
          after: {
            5000: "quoting",
          },
        },
      },
    },
    Swapping: {
      invoke: {
        src: "submitingSwap",
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

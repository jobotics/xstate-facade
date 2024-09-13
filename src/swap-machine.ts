import { createActor, setup, fromPromise, assign } from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";
import {
  Events,
  Input,
  Quote,
  QuoteParams,
} from "./interfaces/swap-machine.ex.interface";
import {
  Intent,
  SwapProgressEnum,
} from "./interfaces/swap-machine.in.interface";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";

const intentProcessorService = new IntentProcessorService(new ApiService());

const swapMachine = setup({
  types: {} as {
    context: {
      intent: Partial<Intent>;
      state: SwapProgressEnum;
      quotes: Quote[];
    };
    events: Events;
    input: Partial<Input>;
  },
  guards: {
    hasValidForRecovering: ({
      context,
    }: {
      context: { intent: Partial<Intent> };
    }) => !!context.intent?.intentId,
    hasValidForQuoting: ({
      context,
    }: {
      context: { intent: Partial<Intent> };
    }) => {
      const intent = context.intent;
      return !!(intent?.assetIn && intent?.assetOut && intent?.amountIn);
    },
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
    submitQuote: fromPromise(({ input }: { input: { intent: Input } }) =>
      intentProcessorService
        .prepareSwapCallData(input.intent)
        .then((callData) => ({
          callData,
        })),
    ),
    submitSwap: fromPromise(({ input }: { input: { hash: string } }) =>
      intentProcessorService.readTransaction(input.hash).then((callData) => ({
        callData,
      })),
    ),
    fetchIntent: fromPromise(({ input }: { input: { intentId: string } }) =>
      intentProcessorService.fetchIntent(input.intentId).then((data) => data),
    ),
    rollbackIntent: fromPromise(
      ({ input }: { input: Pick<Intent, "intentId"> }) =>
        intentProcessorService.initialize(input.intentId).then((data) => data),
    ),
  },
  actions: {
    failRecoverIntent: () => {
      console.log("failRecoverIntent");
    },
    failQuotingIntent: () => {
      console.log("failQuotingIntent");
    },
    failSubmitIntent: () => {
      console.log("failSubmitIntent");
    },
    failSubmittingIntent: () => {
      console.log("failSubmittingIntent");
    },
    failSwappingIntent: () => {
      console.log("failSwappingIntent");
    },
    failRollbackIntent: () => {
      console.log("failRollbackIntent");
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
      initial: "initializeIntent",
      states: {
        initializeIntent: {
          always: [
            {
              target: "recoverIntent",
              guard: "hasValidForRecovering",
            },
            {
              target: "#swapMachine.Quoting",
              guard: "hasValidForQuoting",
            },
          ],
        },
        recoverIntent: {
          invoke: {
            src: "recoverIntent",
            input: ({ context }: { context: { intent: Partial<Intent> } }) => ({
              intentId: context.intent?.intentId ?? "",
            }),
            onDone: {
              target: "#swapMachine.Swapping",
            },
            onError: {
              actions: ["failRecoverIntent"],
            },
          },
        },
        rollbackIntent: {
          invoke: {
            src: "rollbackIntent",
            input: ({ context }: { context: { intent: Partial<Intent> } }) => ({
              intentId: context.intent?.intentId ?? "",
            }),
            onDone: {
              target: "#swapMachine.Confirmed",
            },
            onError: {
              actions: ["failRollbackIntent"],
            },
          },
        },
      },
    },
    Quoting: {
      initial: "quoting",
      invoke: {
        src: "submitQuote",
        input: ({ context }: { context: { intent: Partial<Input> } }) => ({
          intent: context.intent as Input,
        }),
        onDone: {
          target: "#swapMachine.Submitting",
        },
        onError: {
          actions: ["failQuotingIntent"],
        },
      },
      states: {
        quoting: {
          invoke: {
            src: "fetchQuotes",
            input: ({ context }: { context: { intent: Partial<Intent> } }) => ({
              assetIn: context.intent!.assetIn!,
              assetOut: context.intent!.assetOut!,
              amountIn: context.intent!.amountIn!,
            }),
            onDone: {
              target: "quoted",
            },
            onError: {
              actions: ["failQuotingIntent"],
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
    Submitting: {
      invoke: {
        src: "submitSwap",
        input: ({ context }: { context: { intent: Partial<Input> } }) => ({
          hash: context.intent.hash as string,
        }),
        onDone: {
          target: "#swapMachine.Swapping",
        },
        onError: {
          actions: ["failSubmittingIntent"],
        },
      },
    },
    Swapping: {
      invoke: {
        src: "fetchIntent",
        input: ({ context }: { context: { intent: Partial<Input> } }) => ({
          intentId: context.intent.intentId as string,
        }),
        onDone: {
          target: "Confirmed",
        },
        onError: {
          actions: ["failSwappingIntent"],
        },
      },
    },
    Confirmed: {
      type: "final",
    },
    Failed: {
      on: {
        ROLLBACK_INTENT: {
          target: "Loading",
          actor: "rollbackIntent",
          input: ({ context }: { context: { intent: Partial<Input> } }) => ({
            intentId: context.intent.intentId as string,
          }),
        },
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

export { swapMachine };

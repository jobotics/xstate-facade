import { createActor, setup, fromPromise, assign, emit } from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";
import {
  Context,
  Events,
  Input,
  QuoteParams,
} from "./interfaces/swap-machine.ex.interface";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";
import { SolverQuote } from "./interfaces/swap-machine.in.interface";

const intentProcessorService = new IntentProcessorService(new ApiService());

export const swapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
    output: {} as SolverQuote[],
  },
  actions: {
    updateQoutes: assign({
      quotes: ({ event }) => event.output || [],
    }),
    saveBestQuote: assign({
      quotes: ({ event, context }) => [
        ...context.quotes,
        event.data!.bestQuote,
      ],
    }),
    saveProofOfBroadcasting: assign({
      intent: ({ event, context }) => ({
        ...context.intent,
        proof: event.data!.proof,
      }),
    }),
    emitErrorAgreementing: function (_, params) {
      emit({ type: "errorAgreementing", params });
    },
    emitSuccessAgreementing: function (_, params) {
      emit({ type: "successAgreementing", params });
    },
    emitSuccessBroadcasting: function (_, params) {
      emit({ type: "successBroadcasting", params });
    },
    emitErrorBroadcasting: function (_, params) {
      emit({ type: "errorBroadcasting", params });
    },
    emitSuccessSettling: function (_, params) {
      emit({ type: "successSettling", params });
    },
    emitErrorSettling: function (_, params) {
      emit({ type: "errorSettling", params });
    },
    emitSuccessQuoting: function (_, params) {
      emit({ type: "successQuoting", params });
    },
    emitErrorQuoting: function (_, params) {
      emit({ type: "errorQuoting", params });
    },
  },
  actors: {
    signMessage: fromPromise(async ({ input }) => {
      return intentProcessorService.generateMessage(input).then((data) => data);
    }),
    updateIntentState: fromPromise(async ({ input }) => {
      return intentProcessorService
        .updateIntentState(input)
        .then((data) => data);
    }),
    sendMessage: fromPromise(async ({ input }) => {
      return intentProcessorService.sendMessage(input).then((data) => data);
    }),
    fetchQuotes: fromPromise(({ input }: { input: Partial<QuoteParams> }) => {
      return intentProcessorService.fetchQuotes(input).then((data) => data);
    }),
  },
  guards: {
    isSettled: function ({ context, event }) {
      // Add your guard condition here
      return true;
    },
    isIntentIdRegistered: function isIntentIdRegistered({ context }) {
      return !!context?.intent?.intentId;
    },
    isServiceOffline: function ({ context, event }) {
      // Add your guard condition here
      return true;
    },
    isEligibleForSigning: function ({ context, event }) {
      // Add your guard condition here
      return true;
    },
    isEligibleForRetry: function ({ context, event }) {
      // Add your guard condition here
      return true;
    },
  },
}).createMachine({
  context: ({ input }: { input: Partial<Input> }) => ({
    intent: {
      assetIn: input?.assetIn || undefined,
      assetOut: input?.assetOut || undefined,
      amountIn: input?.amountIn || undefined,
      intentId: input?.intentId || undefined,
    },
    quotes: [],
    bestQuote: null,
  }),
  id: "intent_presentation",
  type: "parallel",
  states: {
    Swapping: {
      initial: "Idle",
      states: {
        Idle: {
          on: {
            APPROVE_QUOTE: {
              target: "Signing",
              description:
                "User action event of willing to signMessage quote from solver.",
            },
          },
          always: {
            target: "Settling",
            guard: {
              type: "isIntentIdRegistered",
            },
            description: "The intention was started earlier and not completed.",
          },
          description:
            "Handle initializing a new intent or recovering an existing one.\n\nResult \\[Branching\\]:\n\n1. Transition to APPROVE_QUOTE for new intent;\n2. Transition to Settling for old intent;",
        },
        Signing: {
          // entry: [
          //   {
          //     type: "saveBestQuote",
          //   },
          // ],
          invoke: {
            id: "signMessage",
            input: {
              message: "I'm ready to sign my part (left side of agreement)",
            },
            onDone: {
              target: "Broadcasting",
              // actions: {
              //   type: "emitSuccessAgreementing",
              // },
            },
            onError: {
              target: "ErrorHandling",
              // actions: {
              //   type: "emitErrorAgreementing",
              // },
            },
            src: "signMessage",
          },
          description:
            "Generating sign message, wait for the proof of sign (signature).\n\nResult:\n\n- Update \\[context\\] with selected best quote;\n- Callback event to user for signing the solver message by wallet;",
        },
        Settling: {
          after: {
            "500": {
              target: "Settling",
              description: "Repeat Settling and \n\ngetting up to date status.",
            },
          },
          invoke: {
            id: "updateIntentState",
            input: {},
            onDone: {
              target: "#intent_presentation.Swapping.Finishing.Confirmed",
              // actions: {
              //   type: "emitSuccessSettling",
              // },
              guard: {
                type: "isSettled",
              },
            },
            onError: {
              target: "ErrorHandling",
              // actions: {
              //   type: "emitErrorSettling",
              // },
            },
            src: "updateIntentState",
          },
          description:
            "Fetching intent status until settlement. \n\nIf the status is verified then transition to the Finishing, \n\notherwise run cycle again through Fetching.\n\nResult:\n\n- Update \\[context\\] with intent status;",
        },
        ErrorHandling: {
          always: [
            {
              target: "#intent_presentation.Swapping.Finishing.Failed",
              guard: {
                type: "isServiceOffline",
              },
              description:
                "In case of solve bus or side Api are unavailable. \n\nOr in case RPC is off or overloaded.",
            },
            {
              target: "Signing",
              guard: {
                type: "isEligibleForSigning",
              },
            },
            {
              target: "Broadcasting",
              guard: {
                type: "isEligibleForRetry",
              },
            },
          ],
          description: "A single decision state acts as an error transistor.",
        },
        Broadcasting: {
          invoke: {
            id: "sendMessage",
            input: {
              message:
                "I received signature from user and ready to sign my part (left+right side of agreement)",
            },
            onDone: {
              target: "Settling",
              // actions: [
              //   {
              //     type: "saveProofOfBroadcasting",
              //   },
              //   {
              //     type: "emitSuccessBroadcasting",
              //   },
              // ],
            },
            onError: {
              target: "ErrorHandling",
              // actions: {
              //   type: "emitErrorBroadcasting",
              // },
            },
            src: "sendMessage",
          },
          description:
            "Send user proof of sign (signature) to solver bus.\n\nResult:\n\n- Update \\[context\\] with proof of broadcasting from solver;",
        },
        Finishing: {
          type: "parallel",
          description:
            "The intention is in a final state and the intent swap machine has stopped.\n\nResult:\n\n- Update \\[context\\] with either Confirmed or Failed status.",
          states: {
            Confirmed: {
              type: "final",
              description:
                "The intent was executed in the successful state. \n\nThe user received the required token.",
            },
            Failed: {
              type: "final",
              description: "The intent was failed with with message.",
            },
          },
        },
      },
    },
    Quoting: {
      after: {
        "500": {
          target: "Quoting",
        },
      },
      invoke: {
        id: "fetchQuotes",
        input: ({ context }: { context: Context }) => ({
          assetIn: context.intent.assetIn,
          amountIn: context.intent.amountIn,
          assetOut: context.intent.assetOut,
        }),
        onDone: {
          actions: [
            assign({
              quotes: ({ event }) => event.output || [],
            }),
          ],
        },
        onError: {
          // actions: {
          //   type: "emitErrorQuoting",
          // },
        },
        src: "fetchQuotes",
      },
      description:
        "Polling the solver bus and receiving proposals through POST requests. \n\nLater, we plan to switch to two-way communication using WebSockets.\n\nResult:\n\n- Update \\[context\\] with list of quotes;",
    },
  },
});

const isInspectEnabled = process.env.VITE_INSPECT === "true";
if (isInspectEnabled) {
  const { inspect } = createBrowserInspector();
  const actor = createActor(swapMachine, {
    inspect,
    input: {
      assetIn: "",
      assetOut: "",
      amountIn: "",
    },
  });
  actor.start();
}

import {
  createActor,
  setup,
  fromPromise,
  assign,
  emit,
  AnyEventObject,
  spawnChild,
} from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";
import {
  Context,
  Events,
  Input,
  QuoteParams,
} from "./interfaces/swap-machine.ex.interface";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";
import {
  SolverQuote,
  StateActionAny,
} from "./interfaces/swap-machine.in.interface";

const intentProcessorService = new IntentProcessorService(new ApiService());

export const swapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
  },
  actions: {
    prepareSignMessage: assign({
      signedMessage: ({ context }) =>
        intentProcessorService.generateMessage(context),
    }),
    saveBestQuote: assign({
      bestQuote: ({ event }) => (event.output as SolverQuote) || null,
    }),
    saveProofOfBroadcasting: assign({
      intent: ({ event, context }) => ({
        ...context.intent,
        proof: (event.data as { proof: string }).proof,
      }),
    }),
    emitSuccessBroadcasting: function ({ context, event }, params) {
      emit({ type: "successBroadcasting", params });
    },
    emitErrorBroadcasting: function ({ context, event }, params) {
      emit({ type: "errorBroadcasting", params });
    },
    emitSuccessSetteling: function ({ context, event }, params) {
      emit({ type: "successSetteling", params });
    },
    emitErrorSetteling: function ({ context, event }, params) {
      emit({ type: "errorSetteling", params });
    },
    emitSuccessSigning: function ({ context, event }, params) {
      emit({ type: "successSigning", params });
    },
    emitErrorSigning: function ({ context, event }, params) {
      emit({ type: "errorSigning", params });
    },
    updateQuotes: assign({
      quotes: ({ event }) => (event.data as SolverQuote[]) || [],
    }),
  },
  actors: {
    signMessage: fromPromise(async ({ input }) => {
      return intentProcessorService.signMessage(input).then((data) => data);
    }), // !IMPORTANT signMessage - Must be provided externaly with implementation
    broadcastMessage: fromPromise(async ({ input }) => {
      return intentProcessorService.sendMessage(input).then((data) => data);
    }),
    updateIntentState: fromPromise(async ({ input }) => {
      return intentProcessorService
        .updateIntentState(input)
        .then((data) => data);
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
  context: ({ input }: { input: Partial<Input> }) => {
    return {
      intent: {
        intentId: input?.intentId ?? undefined,
      },
      quotes: [],
      bestQuote: null,
      signedMessage: null,
    };
  },
  id: "swap_machine",
  initial: "Swapping",
  states: {
    Swapping: {
      initial: "Idle",
      states: {
        Idle: {
          on: {
            UPDATE_QUOTES: {
              actions: {
                type: "updateQuotes",
              } as StateActionAny,
              description:
                "Subscribes to updates from quote_machine.\n\nEach time the quote_machine emits a quotes\n\nupdate event, this event should be fired to\n\nupdate context.quotes.",
            },
            SUBMIT_SWAP: {
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
            "Handle initializing a new intent or recovering an existing one.\n\nResult \\[Branching\\]:\n\n1. Transition to Signing for new intent;\n2. Transition to Setteling for old intent;",
        },
        Signing: {
          entry: [
            {
              type: "prepareSignMessage",
            },
            {
              type: "saveBestQuote",
            },
          ] as StateActionAny,
          invoke: {
            id: "signMessage",
            input: ({ context }: { context: Context }) => context.signedMessage,
            onDone: {
              target: "Broadcasting",
              actions: {
                type: "emitSuccessSigning",
              } as StateActionAny,
            },
            onError: {
              target: "ErrorHandling",
              actions: {
                type: "emitErrorSigning",
              } as StateActionAny,
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
              target: "#swap_machine.Swapping.Finishing.Confirmed",
              actions: {
                type: "emitSuccessSetteling",
              } as StateActionAny,
              guard: {
                type: "isSettled",
              },
            },
            onError: {
              target: "ErrorHandling",
              actions: {
                type: "emitErrorSetteling",
              } as StateActionAny,
            },
            src: "updateIntentState",
          },
          description:
            "Fetching intent status until settlement. \n\nIf the status is verified then transition to the Finishing, \n\notherwise run cycle again through Fetching.\n\nResult:\n\n- Update \\[context\\] with intent status;",
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
              actions: [
                {
                  type: "saveProofOfBroadcasting",
                },
                {
                  type: "emitSuccessBroadcasting",
                },
              ] as StateActionAny,
            },
            onError: {
              target: "ErrorHandling",
              actions: {
                type: "emitErrorBroadcasting",
              } as StateActionAny,
            },
            src: "broadcastMessage",
          },
          description:
            "Send user proof of sign (signature) to solver bus \\[relay responsibility\\].\n\nResult:\n\n- Update \\[context\\] with proof of broadcasting from solver;",
        },
        ErrorHandling: {
          always: [
            {
              target: "#swap_machine.Swapping.Finishing.Failed",
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

import { QuoteParams } from "../interfaces/swap-machine.ex.interface";
import { SwapProgressEnum } from "../interfaces/swap-machine.in.interface";

export default {
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
              target: "#swapMachine.Swapping",
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
              target: "quoted",
              actions: ["emitQuotingEvent"],
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
          on: {
            FETCH_QUOTE_SUCCESS: {
              target: "#swapMachine.Submitting",
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
            onDone: {
              target: "waitingForSign",
            },
            onError: {
              target: "#swapMachine.Failed",
              actions: ["failIntent"],
            },
          },
        },
        waitingForSign: {
          on: {
            SUBMIT_SWAP_SUCCESS: {
              target: "#swapMachine.Swapping",
              guard: "hasValidForSwapping",
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
        ROLLBACK_INTENT: {
          acttion: ["rollbackIntent"],
          guard: "hasValidForRollback",
        },
      },
    },
  },
};
